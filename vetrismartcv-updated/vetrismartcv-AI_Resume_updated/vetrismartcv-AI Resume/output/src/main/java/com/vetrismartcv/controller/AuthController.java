package com.vetrismartcv.controller;

import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Autowired
    private UserService userService;

    /* ---- POST /api/auth/register ---- */
    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        String name = body.get("name");
        String email = body.get("email");
        String password = body.get("password");

        if (name == null || email == null || password == null || name.isBlank() || email.isBlank() || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "All fields required."));
        }

        Map<String, Object> result = userService.register(name, email, password);
        if (Boolean.TRUE.equals(result.get("success"))) {
            @SuppressWarnings("unchecked")
            Map<String, Object> userMap = (Map<String, Object>) result.get("user");
            session.setAttribute("userId", userMap.get("id"));
            session.setAttribute("userName", userMap.get("name"));
            session.setAttribute("userPlan", userMap.get("plan"));
        }
        return ResponseEntity.ok(result);
    }

    /* ---- POST /api/auth/login ---- */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        String email = body.get("email");
        String password = body.get("password");

        Map<String, Object> result = userService.login(email, password);
        if (Boolean.TRUE.equals(result.get("success"))) {
            @SuppressWarnings("unchecked")
            Map<String, Object> userMap = (Map<String, Object>) result.get("user");
            session.setAttribute("userId", userMap.get("id"));
            session.setAttribute("userName", userMap.get("name"));
            session.setAttribute("userPlan", userMap.get("plan"));
        }
        return ResponseEntity.ok(result);
    }

    /* ---- POST /api/auth/logout ---- */
    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.ok(Map.of("success", true));
    }

    /* ---- GET /api/auth/session ---- */
    @GetMapping("/session")
    public ResponseEntity<Map<String, Object>> getSession(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        Map<String, Object> resp = new HashMap<>();
        if (userId != null) {
            resp.put("loggedIn", true);
            userService.getById(userId).ifPresent(u -> {
                resp.put("user", userService.safeUser(u));
            });
        } else {
            resp.put("loggedIn", false);
        }
        return ResponseEntity.ok(resp);
    }

    /* ---- POST /api/auth/oauth ---- */
    // Called after Google/LinkedIn OAuth (frontend handles popup, sends token/profile data)
    @PostMapping("/oauth")
    public ResponseEntity<Map<String, Object>> oauthLogin(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        String provider = body.getOrDefault("provider", "GOOGLE");
        String providerId = body.get("providerId");
        String name = body.get("name");
        String email = body.get("email");

        if (email == null || providerId == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "OAuth data missing."));
        }

        User user = userService.oauthLoginOrRegister(provider, providerId, name, email);
        session.setAttribute("userId", user.getId());
        session.setAttribute("userName", user.getName());
        session.setAttribute("userPlan", user.getPlan());

        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("user", userService.safeUser(user));
        return ResponseEntity.ok(resp);
    }

    /* ---- POST /api/auth/upgrade ---- */
    @PostMapping("/upgrade")
    public ResponseEntity<Map<String, Object>> upgrade(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Not logged in."));
        }
        String plan = body.get("plan");
        User updated = userService.upgradePlan(userId, plan);
        session.setAttribute("userPlan", updated.getPlan());
        return ResponseEntity.ok(Map.of("success", true, "plan", updated.getPlan()));
    }
}
