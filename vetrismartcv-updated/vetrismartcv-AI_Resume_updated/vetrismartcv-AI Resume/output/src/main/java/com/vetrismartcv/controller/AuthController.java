package com.vetrismartcv.controller;

import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import com.vetrismartcv.service.VisitorAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    @Autowired
    private UserService userService;

    @Autowired
    private VisitorAnalyticsService visitorAnalyticsService;

    private Map<String, Object> buildSessionResponse(HttpSession session) {
        Map<String, Object> resp = new HashMap<>();
        Long userId = (Long) session.getAttribute("userId");
        int timeoutSeconds = Math.max(session.getMaxInactiveInterval(), 0);

        resp.put("loggedIn", userId != null);
        resp.put("sessionTimeoutSeconds", timeoutSeconds);
        resp.put("serverTime", System.currentTimeMillis());
        resp.put("warningThresholdSeconds", Math.min(120, Math.max(30, timeoutSeconds / 12)));

        if (userId != null) {
            userService.getById(userId).ifPresent(u -> resp.put("user", userService.safeUser(u)));
        }

        return resp;
    }

    /* ---- POST /api/auth/register ---- */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @RequestBody Map<String, String> body,
            HttpSession session,
            HttpServletRequest request) {

        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || email == null || password == null || name.isBlank() || email.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "All fields required."));
        }

        try {
            Map<String, Object> result = userService.register(name, email, password);
            if (Boolean.TRUE.equals(result.get("success"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> userMap = (Map<String, Object>) result.get("user");
                // Session fixation protection: rotate the session ID now that
                // the user is authenticated, before attaching their identity
                // to it. Without this, a session ID an attacker fixed on the
                // victim's browser before registration would remain valid
                // (and now authenticated) after this call.
                request.changeSessionId();
                session.setAttribute("userId", userMap.get("id"));
                session.setAttribute("userName", userMap.get("name"));
                session.setAttribute("userPlan", userMap.get("plan"));
                session.setAttribute("userRole", userMap.get("role"));
                visitorAnalyticsService.recordLogin((Long) userMap.get("id"), session, request);
                return ResponseEntity.ok(result);
            }
            return ResponseEntity.badRequest().body(result);
        } catch (Exception e) {
            log.error("Registration request failed for email {}", email, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Server error while creating account. Please try again."));
        }
    }

    /* ---- POST /api/auth/login ---- */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body,
            HttpSession session,
            HttpServletRequest request) {

        String email = body.get("email");
        String password = body.get("password");

        try {
            Map<String, Object> result = userService.login(email, password);
            if (Boolean.TRUE.equals(result.get("success"))) {
                @SuppressWarnings("unchecked")
                Map<String, Object> userMap = (Map<String, Object>) result.get("user");
                // Session fixation protection — see the same comment in register().
                request.changeSessionId();
                session.setAttribute("userId", userMap.get("id"));
                session.setAttribute("userName", userMap.get("name"));
                session.setAttribute("userPlan", userMap.get("plan"));
                session.setAttribute("userRole", userMap.get("role"));
                visitorAnalyticsService.recordLogin((Long) userMap.get("id"), session, request);
            }
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Login request failed for email {}", email, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Server error while signing in. Please try again."));
        }
    }

    /* ---- POST /api/auth/logout ---- */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpSession session) {
        visitorAnalyticsService.recordLogout(session);
        session.invalidate();
        return ResponseEntity.ok(Map.of("success", true));
    }

    /* ---- GET /api/auth/session ---- */
    @GetMapping("/session")
    public ResponseEntity<Map<String, Object>> getSession(HttpSession session, HttpServletRequest request) {
        Long userId = (Long) session.getAttribute("userId");
        visitorAnalyticsService.recordActivity(userId, session, request);
        return ResponseEntity.ok(buildSessionResponse(session));
    }

    @PostMapping("/visitor-location")
    public ResponseEntity<Map<String, Object>> updateVisitorLocation(
            @RequestBody Map<String, Object> body,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "message", "Not logged in."
            ));
        }
        visitorAnalyticsService.updateCurrentLocation(
                session,
                toDouble(body.get("latitude")),
                toDouble(body.get("longitude")),
                body.get("label") == null ? null : String.valueOf(body.get("label"))
        );
        return ResponseEntity.ok(Map.of("success", true));
    }

    /* ---- POST /api/auth/oauth ---- */
    // Called after Google/LinkedIn OAuth (frontend handles popup, sends token/profile data)
    @PostMapping("/oauth")
    public ResponseEntity<Map<String, Object>> oauthLogin(
            @RequestBody Map<String, String> body,
            HttpSession session,
            HttpServletRequest request) {

        String provider = body.getOrDefault("provider", "GOOGLE");
        String providerId = body.get("providerId");
        String name = body.get("name");
        String email = body.get("email");

        if (email == null || providerId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "OAuth data missing."));
        }

        try {
            User user = userService.oauthLoginOrRegister(provider, providerId, name, email);
            // Session fixation protection — see the same comment in register().
            request.changeSessionId();
            session.setAttribute("userId", user.getId());
            session.setAttribute("userName", user.getName());
            session.setAttribute("userPlan", user.getPlan());
            session.setAttribute("userRole", user.getRole());
            visitorAnalyticsService.recordLogin(user.getId(), session, request);

            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("user", userService.safeUser(user));
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            log.error("OAuth request failed for provider {} and email {}", provider, email, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Server error while signing in with " + provider + "."));
        }
    }

    /* ---- POST /api/auth/forgot-password ---- */
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, Object>> forgotPassword(
            @RequestBody Map<String, String> body) {

        String email = body.get("email");

        if (email == null || email.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "message", "Email address is required."));
        }

        try {
            Map<String, Object> result = userService.initiatePasswordResetResult(email.trim().toLowerCase());
            Object statusObj = result.get("status");
            int status = statusObj instanceof Number ? ((Number) statusObj).intValue() : 200;
            result.remove("status");
            return ResponseEntity.status(status).body(result);
        } catch (Exception e) {
            log.error("Password reset initiation failed for email {}", email, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Could not send reset password email. Please try again later."));
        }
    }

    /* ---- POST /api/auth/reset-password ---- */
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, Object>> resetPassword(
            @RequestBody Map<String, String> body) {

        String token = body.get("token");
        String password = body.get("password");

        try {
            Map<String, Object> result = userService.resetPassword(token, password);
            Object statusObj = result.get("status");
            int status = statusObj instanceof Number ? ((Number) statusObj).intValue() : 200;
            result.remove("status");
            return ResponseEntity.status(status).body(result);
        } catch (Exception e) {
            log.error("Password reset failed for token {}", token, e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "message", "Could not reset password. Please try again later."));
        }
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