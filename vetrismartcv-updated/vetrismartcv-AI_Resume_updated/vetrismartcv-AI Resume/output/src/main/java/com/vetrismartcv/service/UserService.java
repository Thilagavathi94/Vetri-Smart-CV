package com.vetrismartcv.service;

import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    /* ---- REGISTER ---- */
    public Map<String, Object> register(String name, String email, String password) {
        Map<String, Object> result = new HashMap<>();
        String normalizedName = safeTrim(name);
        String normalizedEmail = normalizeEmail(email);

        if (normalizedName.isBlank() || normalizedEmail.isBlank() || password == null || password.isBlank()) {
            result.put("success", false);
            result.put("message", "All fields required.");
            return result;
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            result.put("success", false);
            result.put("message", "Email already registered.");
            return result;
        }

        try {
            User user = User.builder()
                    .name(normalizedName)
                    .email(normalizedEmail)
                    .password(hashPassword(password))
                    .provider("LOCAL")
                    .plan("FREE")
                    .resumeDownloads(0)
                    .build();

            userRepository.save(user);
            result.put("success", true);
            result.put("user", safeUser(user));
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Could not create account. Please try again.");
        }
        return result;
    }

    /* ---- LOGIN ---- */
    public Map<String, Object> login(String email, String password) {
        Map<String, Object> result = new HashMap<>();
        String normalizedEmail = normalizeEmail(email);

        if (normalizedEmail.isBlank() || password == null || password.isBlank()) {
            result.put("success", false);
            result.put("message", "Email and password are required.");
            return result;
        }

        Optional<User> opt = userRepository.findByEmail(normalizedEmail);
        if (opt.isEmpty()) {
            result.put("success", false);
            result.put("message", "No account found with this email.");
            return result;
        }

        User user = opt.get();
        if (!"LOCAL".equalsIgnoreCase(user.getProvider()) && (user.getPassword() == null || user.getPassword().isBlank())) {
            result.put("success", false);
            result.put("message", "This account uses " + user.getProvider() + " login. Please sign in with " + user.getProvider() + ".");
            return result;
        }
        if (!user.getPassword().equals(hashPassword(password))) {
            result.put("success", false);
            result.put("message", "Incorrect password.");
            return result;
        }

        result.put("success", true);
        result.put("user", safeUser(user));
        return result;
    }

    /* ---- OAUTH LOGIN/REGISTER ---- */
    public User oauthLoginOrRegister(String provider, String providerId, String name, String email) {
        Optional<User> existing = userRepository.findByProviderAndProviderId(provider, providerId);
        if (existing.isPresent()) return existing.get();
        String normalizedEmail = normalizeEmail(email);
        String normalizedName = safeTrim(name);

        // Check if email already exists
        Optional<User> byEmail = userRepository.findByEmail(normalizedEmail);
        if (byEmail.isPresent()) {
            User u = byEmail.get();
            u.setProvider(provider);
            u.setProviderId(providerId);
            if ((u.getName() == null || u.getName().isBlank()) && !normalizedName.isBlank()) {
                u.setName(normalizedName);
            }
            return userRepository.save(u);
        }

        User user = User.builder()
                .name(normalizedName)
                .email(normalizedEmail)
                .provider(provider)
                .providerId(providerId)
                .plan("FREE")
                .resumeDownloads(0)
                .build();
        return userRepository.save(user);
    }

    /* ---- GET USER ---- */
    public Optional<User> getById(Long id) {
        return userRepository.findById(id);
    }

    /* ---- UPDATE PLAN ---- */
    public User upgradePlan(Long userId, String plan) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        user.setPlan(plan);
        return userRepository.save(user);
    }

    /* ---- INCREMENT DOWNLOADS ---- */
    public void incrementDownload(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            u.setResumeDownloads(u.getResumeDownloads() + 1);
            userRepository.save(u);
        });
    }

    /* ---- SAFE USER MAP (no password) ---- */
    public Map<String, Object> safeUser(User user) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", user.getId());
        m.put("name", user.getName());
        m.put("email", user.getEmail());
        m.put("plan", user.getPlan());
        m.put("resumeDownloads", user.getResumeDownloads());
        m.put("provider", user.getProvider());
        m.put("createdAt", user.getCreatedAt());
        return m;
    }

    /* ---- SIMPLE PASSWORD HASH (use BCrypt in production) ---- */
    private String hashPassword(String password) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(password.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : hash) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new RuntimeException("Hash error", e);
        }
    }

    private String normalizeEmail(String email) {
        return safeTrim(email).toLowerCase(Locale.ROOT);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
