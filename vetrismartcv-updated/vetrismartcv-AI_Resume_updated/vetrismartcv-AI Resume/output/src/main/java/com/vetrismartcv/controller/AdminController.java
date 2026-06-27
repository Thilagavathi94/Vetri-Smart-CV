package com.vetrismartcv.controller;

import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import com.vetrismartcv.service.VisitorAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;
    private final VisitorAnalyticsService visitorAnalyticsService;

    public AdminController(UserService userService, VisitorAnalyticsService visitorAnalyticsService) {
        this.userService = userService;
        this.visitorAnalyticsService = visitorAnalyticsService;
    }

    @GetMapping("/users")
    public ResponseEntity<Map<String, Object>> users(
            @RequestParam(required = false) String q,
            HttpSession session) {
        if (!isAdmin(session)) {
            return forbidden();
        }
        return ResponseEntity.ok(Map.of(
                "success", true,
                "summary", userService.adminSummary(),
                "users", userService.findUsersForAdmin(q)
        ));
    }

    @PatchMapping("/users/{id}/plan")
    public ResponseEntity<Map<String, Object>> updatePlan(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            HttpSession session) {
        if (!isAdmin(session)) {
            return forbidden();
        }
        User updated = userService.updateUserPlan(id, body.get("plan"));
        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", userService.adminUser(updated)
        ));
    }

    @PatchMapping("/users/{id}/role")
    public ResponseEntity<Map<String, Object>> updateRole(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            HttpSession session) {
        if (!isAdmin(session)) {
            return forbidden();
        }

        Long currentUserId = (Long) session.getAttribute("userId");
        if (id.equals(currentUserId) && "USER".equalsIgnoreCase(body.get("role"))) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "You cannot remove your own admin access."
            ));
        }

        User updated = userService.updateUserRole(id, body.get("role"));
        return ResponseEntity.ok(Map.of(
                "success", true,
                "user", userService.adminUser(updated)
        ));
    }

    @GetMapping("/visitor-analytics")
    public ResponseEntity<Map<String, Object>> visitorAnalytics(
            @RequestParam(required = false) LocalDate date,
            @RequestParam(required = false) LocalDate fromDate,
            @RequestParam(required = false) LocalDate toDate,
            HttpSession session,
            HttpServletRequest request) {
        if (!isAdmin(session)) {
            return forbidden();
        }
        visitorAnalyticsService.recordActivity((Long) session.getAttribute("userId"), session, request);

        LocalDate resolvedFrom = date != null ? date : fromDate;
        LocalDate resolvedTo = date != null ? date : toDate;

        return ResponseEntity.ok(Map.of(
                "success", true,
                "analytics", visitorAnalyticsService.analytics(resolvedFrom, resolvedTo)
        ));
    }

    @PostMapping("/visitor-analytics/location")
    public ResponseEntity<Map<String, Object>> updateVisitorLocation(
            @RequestBody Map<String, Object> body,
            HttpSession session) {
        if (!isAdmin(session)) {
            return forbidden();
        }
        Double latitude = toDouble(body.get("latitude"));
        Double longitude = toDouble(body.get("longitude"));
        String label = body.get("label") == null ? null : String.valueOf(body.get("label"));
        visitorAnalyticsService.updateCurrentLocation(session, latitude, longitude, label);
        return ResponseEntity.ok(Map.of("success", true));
    }

    private boolean isAdmin(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        return userService.isAdmin(userId);
    }

    private ResponseEntity<Map<String, Object>> forbidden() {
        return ResponseEntity.status(403).body(Map.of(
                "success", false,
                "message", "Admin access required."
        ));
    }

    private Double toDouble(Object value) {
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
