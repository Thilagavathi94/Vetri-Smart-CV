package com.vetrismartcv.controller;

import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final UserService userService;

    public AdminController(UserService userService) {
        this.userService = userService;
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
}
