package com.vetrismartcv.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Controller;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

/**
 * Handles OAuth 2.0 Authorization Code flow for Google and LinkedIn.
 *
 * FIX: Changed @RestController to @Controller so that redirect responses work correctly.
 * Both Google and LinkedIn perform a full-page browser redirect to the callback URL.
 * Previously the controller returned JSON directly, causing raw JSON to display in the browser.
 *
 * On SUCCESS  → redirect browser to /dashboard (session already set)
 * On FAILURE  → redirect browser to /login?oauth_error=<friendly_message>
 */
@Controller
@RequestMapping("/oauth")
public class OAuthController {

    @Autowired
    private UserService userService;

    @Value("${oauth.google.client-id:NOT_SET}")
    private String googleClientId;

    @Value("${oauth.google.client-secret:NOT_SET}")
    private String googleClientSecret;

    @Value("${oauth.google.redirect-uri:http://localhost:8080/oauth/google/callback}")
    private String googleRedirectUri;

    @Value("${oauth.linkedin.client-id:NOT_SET}")
    private String linkedinClientId;

    @Value("${oauth.linkedin.client-secret:NOT_SET}")
    private String linkedinClientSecret;

    @Value("${oauth.linkedin.redirect-uri:http://localhost:8080/oauth/linkedin/callback}")
    private String linkedinRedirectUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    // ──────────────────────────────────────────────────────────────────────────
    // Google Callback
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/google/callback")
    public ResponseEntity<Void> googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            HttpSession session) {

        if ("NOT_SET".equals(googleClientId) || "NOT_SET".equals(googleClientSecret)) {
            return redirectToLoginWithError("Google sign-in is not available. Please use email/password login.");
        }

        if (code == null || code.isBlank()) {
            return redirectToLoginWithError("Google sign-in failed. Please try again.");
        }

        try {
            // Step 1: Exchange code for tokens
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenBody = new LinkedMultiValueMap<>();
            tokenBody.add("code",          code);
            tokenBody.add("client_id",     googleClientId);
            tokenBody.add("client_secret", googleClientSecret);
            tokenBody.add("redirect_uri",  googleRedirectUri);
            tokenBody.add("grant_type",    "authorization_code");

            ResponseEntity<String> tokenResponse = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                new HttpEntity<>(tokenBody, tokenHeaders),
                String.class
            );

            JsonNode tokenJson = objectMapper.readTree(tokenResponse.getBody());
            String idToken = tokenJson.path("id_token").asText();

            if (idToken == null || idToken.isBlank()) {
                System.err.println("[OAuthController] Google token response missing id_token: " + tokenResponse.getBody());
                return redirectToLoginWithError("Google sign-in failed. Please try again.");
            }

            // Step 2: Decode JWT id_token payload
            String[] parts = idToken.split("\\.");
            if (parts.length < 2) {
                return redirectToLoginWithError("Google sign-in failed. Please try again.");
            }

            String padded = parts[1];
            if (padded.length() % 4 != 0) {
                padded = padded + "=".repeat(4 - padded.length() % 4);
            }
            String payloadJson = new String(
                java.util.Base64.getUrlDecoder().decode(padded),
                java.nio.charset.StandardCharsets.UTF_8
            );
            JsonNode profile = objectMapper.readTree(payloadJson);

            String providerId = profile.path("sub").asText();
            String email      = profile.path("email").asText("");
            String name       = profile.path("name").asText("");
            if (name.isBlank()) {
                name = (profile.path("given_name").asText("") + " " + profile.path("family_name").asText("")).trim();
            }

            if (email.isBlank() || providerId.isBlank()) {
                return redirectToLoginWithError("Could not retrieve your Google account details. Please try again.");
            }

            // Step 3: Upsert user + create session
            User user = userService.oauthLoginOrRegister("GOOGLE", providerId, name, email);
            session.setAttribute("userId",   user.getId());
            session.setAttribute("userName", user.getName());
            session.setAttribute("userPlan", user.getPlan());

            // Step 4: Redirect to dashboard
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "/dashboard")
                    .build();

        } catch (Exception ex) {
            System.err.println("[OAuthController] Google OAuth error: " + ex.getMessage());
            String raw = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
            String msg = raw.contains("redirect_uri") ? "Google sign-in configuration error. Please contact support."
                       : raw.contains("invalid_client") ? "Google sign-in is temporarily unavailable. Please try again later."
                       : "Google sign-in failed. Please try again or use email/password login.";
            return redirectToLoginWithError(msg);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // LinkedIn Callback
    // ──────────────────────────────────────────────────────────────────────────

    @GetMapping("/linkedin/callback")
    public ResponseEntity<Void> linkedinCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription,
            HttpSession session) {

        if (error != null) {
            System.err.println("[OAuthController] LinkedIn error redirect: " + error + " - " + errorDescription);
            return redirectToLoginWithError("LinkedIn sign-in failed. Please try again or use email/password login.");
        }

        if ("NOT_SET".equals(linkedinClientId) || "NOT_SET".equals(linkedinClientSecret)) {
            return redirectToLoginWithError("LinkedIn sign-in is not available. Please use email/password login.");
        }

        if (code == null || code.isBlank()) {
            return redirectToLoginWithError("LinkedIn sign-in failed. Please try again.");
        }

        try {
            // Step 1: Exchange code for access token
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenBody = new LinkedMultiValueMap<>();
            tokenBody.add("grant_type",    "authorization_code");
            tokenBody.add("code",          code);
            tokenBody.add("redirect_uri",  linkedinRedirectUri);
            tokenBody.add("client_id",     linkedinClientId);
            tokenBody.add("client_secret", linkedinClientSecret);

            ResponseEntity<String> tokenResponse = restTemplate.postForEntity(
                "https://www.linkedin.com/oauth/v2/accessToken",
                new HttpEntity<>(tokenBody, tokenHeaders),
                String.class
            );

            JsonNode tokenJson = objectMapper.readTree(tokenResponse.getBody());
            String accessToken = tokenJson.path("access_token").asText();

            if (accessToken == null || accessToken.isBlank()) {
                System.err.println("[OAuthController] LinkedIn token error: " + tokenResponse.getBody());
                return redirectToLoginWithError("LinkedIn sign-in failed. Please try again.");
            }

            // Step 2: Fetch user profile
            HttpHeaders profileHeaders = new HttpHeaders();
            profileHeaders.setBearerAuth(accessToken);

            ResponseEntity<String> profileResponse = restTemplate.exchange(
                "https://api.linkedin.com/v2/userinfo",
                HttpMethod.GET,
                new HttpEntity<>(profileHeaders),
                String.class
            );

            JsonNode profile = objectMapper.readTree(profileResponse.getBody());
            String providerId = profile.path("sub").asText();
            String name       = profile.path("name").asText("");
            String email      = profile.path("email").asText("");

            if (name.isBlank()) {
                name = (profile.path("given_name").asText("") + " " + profile.path("family_name").asText("")).trim();
            }

            if (email.isBlank() || providerId.isBlank()) {
                return redirectToLoginWithError("Could not retrieve your LinkedIn email. Please ensure email permission is granted.");
            }

            // Step 3: Upsert user + create session
            User user = userService.oauthLoginOrRegister("LINKEDIN", providerId, name, email);
            session.setAttribute("userId",   user.getId());
            session.setAttribute("userName", user.getName());
            session.setAttribute("userPlan", user.getPlan());

            // Step 4: Redirect to dashboard
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "/dashboard")
                    .build();

        } catch (Exception ex) {
            System.err.println("[OAuthController] LinkedIn OAuth error: " + ex.getMessage());
            String raw = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
            String msg = raw.contains("redirect_uri") ? "LinkedIn sign-in is temporarily unavailable. Please try again later."
                       : raw.contains("invalid_client") ? "LinkedIn sign-in is temporarily unavailable. Please try again later."
                       : raw.contains("access_denied") ? "LinkedIn sign-in was denied. Please allow the required permissions and try again."
                       : raw.contains("timeout") || raw.contains("connect") ? "Could not reach LinkedIn. Please check your connection and try again."
                       : "LinkedIn sign-in failed. Please try again or use email/password login.";
            return redirectToLoginWithError(msg);
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper
    // ──────────────────────────────────────────────────────────────────────────

    private ResponseEntity<Void> redirectToLoginWithError(String message) {
        try {
            String encoded = java.net.URLEncoder.encode(message, java.nio.charset.StandardCharsets.UTF_8);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "/login?oauth_error=" + encoded)
                    .build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .header("Location", "/login?oauth_error=true")
                    .build();
        }
    }
}