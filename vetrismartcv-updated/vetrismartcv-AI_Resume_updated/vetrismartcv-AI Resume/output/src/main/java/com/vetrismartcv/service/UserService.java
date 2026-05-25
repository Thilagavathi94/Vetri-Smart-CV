package com.vetrismartcv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.nio.charset.StandardCharsets;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;

@Service
@Slf4j
public class UserService {

    private static final Pattern SIGNUP_EMAIL_PATTERN =
            Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,63}$", Pattern.CASE_INSENSITIVE);

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newHttpClient();

    @Autowired
    private UserRepository userRepository;

    private final JavaMailSender mailSender;

    @Value("${app.mail.from:${spring.mail.username:}}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String mailUsername;

    @Value("${spring.mail.password:}")
    private String mailPassword;

    @Value("${resend.api-key:}")
    private String resendApiKey;

    @Value("${resend.from-email:${app.mail.from:${spring.mail.username:}}}")
    private String resendFromEmail;

    @Value("${app.base-url:https://vetri-smart-cv.onrender.com}")
    private String appBaseUrl;

    public UserService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

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

        if (!isValidSignupEmail(normalizedEmail)) {
            result.put("success", false);
            result.put("message", "Please enter a valid existing email address.");
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

    /* ---- INITIATE PASSWORD RESET ---- */
    /**
     * Looks up the user by email. If found, generates a secure reset token,
     * stores it on the user record, and logs it (extend with real email sending).
     * Always returns silently so callers cannot distinguish found vs not-found emails.
     */
    public void initiatePasswordReset(String email) {
        String normalizedEmail = normalizeEmail(email);
        Optional<User> opt = userRepository.findByEmail(normalizedEmail);
        if (opt.isEmpty()) {
            // User not found — return silently to avoid email enumeration
            return;
        }
        User user = opt.get();

        // Generate a secure random token
        String token = UUID.randomUUID().toString().replace("-", "") +
                       Long.toHexString(System.currentTimeMillis());

        // Store token and expiry on the user (extend User entity + DB column as needed)
        // For now we log it so it can be retrieved during development/testing
        System.out.println("[PasswordReset] Reset token for " + normalizedEmail + ": " + token);

        // TODO: Send reset email via JavaMailSender / SendGrid / SES with link:
        // "/reset-password?token=" + token
        // Example:
        // mailService.sendPasswordResetEmail(user.getEmail(), user.getName(), token);
    }

    public Map<String, Object> initiatePasswordResetResult(String email) {
        Map<String, Object> result = new HashMap<>();
        String normalizedEmail = normalizeEmail(email);
        Optional<User> opt = userRepository.findByEmail(normalizedEmail);
        if (opt.isEmpty()) {
            result.put("success", false);
            result.put("message", "Email not registered.");
            result.put("status", 404);
            return result;
        }

        if (!isPasswordResetMailConfigured()) {
            result.put("success", false);
            result.put("message", "Password reset email is not configured. Please contact support.");
            result.put("status", 503);
            return result;
        }

        User user = opt.get();
        String token = UUID.randomUUID().toString().replace("-", "") +
                       Long.toHexString(System.currentTimeMillis());
        user.setPasswordResetToken(token);
        user.setPasswordResetTokenExpiresAt(LocalDateTime.now().plusHours(1));
        userRepository.save(user);

        try {
            sendPasswordResetEmail(user, token);
            result.put("success", true);
            result.put("message", "Reset password link has been sent to your registered email.");
            result.put("status", 200);
            return result;
        } catch (Exception ex) {
            log.error("Failed to send password reset email to {}", normalizedEmail, ex);
            result.put("success", false);
            result.put("message", "Could not send reset password email. Please try again later.");
            result.put("status", 500);
            return result;
        }
    }

    private boolean isPasswordResetMailConfigured() {
        return isResendConfigured()
                || (mailSender != null
                && mailFrom != null && !mailFrom.isBlank()
                && mailUsername != null && !mailUsername.isBlank()
                && mailPassword != null && !mailPassword.isBlank());
    }

    private void sendPasswordResetEmail(User user, String token) throws Exception {
        String resetLink = appBaseUrl.replaceAll("/+$", "") + "/reset-password?token=" + token;
        if (isResendConfigured()) {
            sendPasswordResetEmailViaResend(user, resetLink);
            return;
        }

        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, false, "UTF-8");
        helper.setFrom(mailFrom);
        helper.setTo(user.getEmail());
        helper.setSubject("Reset your VetriSmartCV password");
        helper.setText(buildPasswordResetEmailBody(user, resetLink), false);
        mailSender.send(message);
    }

    private boolean isResendConfigured() {
        return resendApiKey != null && !resendApiKey.isBlank()
                && resendFromEmail != null && !resendFromEmail.isBlank();
    }

    private void sendPasswordResetEmailViaResend(User user, String resetLink) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", resendFromEmail);
        payload.put("to", List.of(user.getEmail()));
        payload.put("subject", "Reset your VetriSmartCV password");
        payload.put("text", buildPasswordResetEmailBody(user, resetLink));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://api.resend.com/emails"))
                .header("Authorization", "Bearer " + resendApiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IllegalStateException("Resend email API failed with HTTP " + response.statusCode() + ": " + response.body());
        }
    }

    private String buildPasswordResetEmailBody(User user, String resetLink) {
        String name = safeTrim(user.getName()).isBlank() ? "there" : safeTrim(user.getName());
        return "Hi " + name + ",\n\n"
                + "We received a request to reset your VetriSmartCV password.\n\n"
                + "Click this link to reset your password:\n"
                + resetLink + "\n\n"
                + "This link will expire in 1 hour. If you did not request this, you can ignore this email.\n\n"
                + "Regards,\n"
                + "VetriSmartCV Team";
    }

    /* ---- INCREMENT DOWNLOADS ---- */
    public void incrementDownload(Long userId) {
        userRepository.findById(userId).ifPresent(u -> {
            int currentDownloads = u.getResumeDownloads() == null ? 0 : u.getResumeDownloads();
            u.setResumeDownloads(currentDownloads + 1);
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

    private boolean isValidSignupEmail(String email) {
        if (email == null || email.length() > 254 || !SIGNUP_EMAIL_PATTERN.matcher(email).matches()) {
            return false;
        }

        String[] parts = email.split("@", -1);
        if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) {
            return false;
        }

        String local = parts[0];
        String domain = parts[1].toLowerCase(Locale.ROOT);
        if (local.startsWith(".") || local.endsWith(".") || local.contains("..") || domain.contains("..")) {
            return false;
        }
        if (Set.of("example.com", "example.org", "example.net", "test.com", "localhost", "invalid").contains(domain)) {
            return false;
        }

        for (String label : domain.split("\\.")) {
            if (label.isBlank() || label.startsWith("-") || label.endsWith("-")) {
                return false;
            }
        }

        try {
            InetAddress.getByName(domain);
            return true;
        } catch (UnknownHostException ex) {
            return false;
        }
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }
}
