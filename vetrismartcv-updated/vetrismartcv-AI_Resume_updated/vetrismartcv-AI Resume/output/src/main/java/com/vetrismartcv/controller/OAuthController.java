package com.vetrismartcv.controller;



import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetrismartcv.model.User;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

/**
 * Handles OAuth 2.0 Authorization Code flow for Google and LinkedIn.
 *
 * Google flow:
 *   1. Frontend redirects user → https://accounts.google.com/o/oauth2/v2/auth
 *   2. Google redirects back  → GET /oauth/google/callback?code=...
 *   3. Controller exchanges code for id_token via https://oauth2.googleapis.com/token
 *   4. Decodes the JWT id_token to extract profile (sub, email, name)
 *   5. Creates/finds user in DB, sets session, returns JSON
 *
 * LinkedIn flow:
 *   1. Frontend redirects user → https://www.linkedin.com/oauth/v2/authorization
 *   2. LinkedIn redirects back → GET /oauth/linkedin/callback?code=...
 *   3. Controller exchanges code for access_token
 *   4. Fetches user profile from https://api.linkedin.com/v2/userinfo
 *   5. Creates/finds user in DB, sets session, returns JSON
 *
 * Configure in application.properties (or environment variables):
 *   oauth.google.client-id, oauth.google.client-secret, oauth.google.redirect-uri
 *   oauth.linkedin.client-id, oauth.linkedin.client-secret, oauth.linkedin.redirect-uri
 *
 * IMPORTANT: Never expose raw OAuth error messages to the frontend.
 * All errors are sanitised to user-friendly messages; raw errors go to server logs only.
 */
@RestController
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


    /**
     * GET /oauth/google/callback?code=...&state=...
     * Handles Google OAuth 2.0 Authorization Code flow callback.
     * Exchanges code for access token, fetches user profile, creates/finds user.
     */
    @GetMapping("/google/callback")
    public ResponseEntity<Map<String, Object>> googleCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            jakarta.servlet.http.HttpSession session) {

        Map<String, Object> error = new HashMap<>();

        // D_019: Google OAuth uses direct full-page redirect (no popup).
        // The frontend uses window.location.assign() without 'prompt: select_account'
        // to avoid the intermediate "Sign in with Google" confirmation popup.
        // Guard: credentials not configured
        if ("NOT_SET".equals(googleClientId) || "NOT_SET".equals(googleClientSecret)) {
            error.put("success", false);
            error.put("message", "Google sign-in is not available in this environment. Please use email/password login.");
            return ResponseEntity.ok(error);
        }

        try {
            // ── STEP 1: Exchange code for tokens ───────────────────────────────
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenBody = new LinkedMultiValueMap<>();
            tokenBody.add("code",          code);
            tokenBody.add("client_id",     googleClientId);
            tokenBody.add("client_secret", googleClientSecret);
            tokenBody.add("redirect_uri",  googleRedirectUri);
            tokenBody.add("grant_type",    "authorization_code");

            HttpEntity<MultiValueMap<String, String>> tokenRequest =
                new HttpEntity<>(tokenBody, tokenHeaders);

            ResponseEntity<String> tokenResponse = restTemplate.postForEntity(
                "https://oauth2.googleapis.com/token",
                tokenRequest,
                String.class
            );

            JsonNode tokenJson = objectMapper.readTree(tokenResponse.getBody());
            String idToken = tokenJson.path("id_token").asText();

            if (idToken == null || idToken.isBlank()) {
                error.put("success", false);
                error.put("message", "Google sign-in failed. Please try again.");
                System.err.println("[OAuthController] Google token response missing id_token: " + tokenResponse.getBody());
                return ResponseEntity.ok(error);
            }

            // ── STEP 2: Decode the JWT id_token to get user profile ────────────
            // The id_token is a signed JWT; decode the payload (middle part) to get claims.
            // For production, verify the signature against Google's public keys.
            String[] parts = idToken.split("\\.");
            if (parts.length < 2) {
                error.put("success", false);
                error.put("message", "Google sign-in failed. Please try again.");
                return ResponseEntity.ok(error);
            }

            // Base64 URL decode the payload
            String payloadJson = new String(
                java.util.Base64.getUrlDecoder().decode(
                    parts[1].length() % 4 == 0 ? parts[1] : parts[1] + "=".repeat(4 - parts[1].length() % 4)
                ),
                java.nio.charset.StandardCharsets.UTF_8
            );
            JsonNode profile = objectMapper.readTree(payloadJson);

            String providerId = profile.path("sub").asText();
            String email      = profile.path("email").asText("");
            String name       = profile.path("name").asText("");
            if (name.isBlank()) {
                String given  = profile.path("given_name").asText("");
                String family = profile.path("family_name").asText("");
                name = (given + " " + family).trim();
            }

            if (email.isBlank() || providerId.isBlank()) {
                error.put("success", false);
                error.put("message", "Could not retrieve your Google account details. Please try again.");
                return ResponseEntity.ok(error);
            }

            // ── STEP 3: Upsert user in DB + create session ─────────────────────
            User user = userService.oauthLoginOrRegister("GOOGLE", providerId, name, email);
            session.setAttribute("userId",   user.getId());
            session.setAttribute("userName", user.getName());
            session.setAttribute("userPlan", user.getPlan());

            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("user", userService.safeUser(user));
            return ResponseEntity.ok(resp);

        } catch (Exception ex) {
            String rawMsg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
            String friendlyMsg;
            if (rawMsg.contains("redirect_uri") || rawMsg.contains("redirect uri")) {
                friendlyMsg = "Google sign-in configuration error. Please contact support.";
            } else if (rawMsg.contains("invalid_client") || rawMsg.contains("client_id")) {
                friendlyMsg = "Google sign-in is temporarily unavailable. Please try again later.";
            } else {
                friendlyMsg = "Google sign-in failed. Please try again or use email/password login.";
            }
            error.put("success", false);
            error.put("message", friendlyMsg);
            System.err.println("[OAuthController] Google OAuth error: " + ex.getMessage());
            return ResponseEntity.ok(error);
        }
    }

    /**
     * GET /oauth/linkedin/callback?code=...&state=...
     *
     * D_018 FIX: LinkedIn may redirect the user browser DIRECTLY to this URL with an error param
     * (e.g. error=redirect_uri_mismatch) when the redirect_uri registered in the LinkedIn app
     * does not match the one sent in the authorization request.
     *
     * This endpoint handles BOTH cases:
     *  - Direct browser navigation (with or without 'code') → returns redirect to /login
     *  - AJAX fetch from the frontend (called with 'code') → returns JSON
     *
     * The redirect_uri_mismatch error must be fixed in the LinkedIn Developer Console:
     * ensure the exact URI (including protocol, host, port, and path) is listed under
     * "Authorized redirect URLs for your app".
     *
     * IMPORTANT: Never expose raw OAuth error strings to the user.
     */
    @GetMapping("/linkedin/callback")
    public ResponseEntity<Map<String, Object>> linkedinCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription,
            HttpSession session,
            jakarta.servlet.http.HttpServletRequest request) {

        // D_018: Handle LinkedIn-originated errors (direct browser redirect, not AJAX)
        // These happen when LinkedIn itself shows an error before even calling our callback
        if (error != null && code == null) {
            System.err.println("[OAuthController] LinkedIn direct error redirect: " + error + " - " + errorDescription);
            // Redirect to login page with a safe, friendly error param — never expose raw error
            String friendlyParam = "linkedin_error=true";
            return ResponseEntity.status(302)
                    .header("Location", "/login?" + friendlyParam)
                    .build();
        }

        Map<String, Object> errorResp = new HashMap<>();

        if (code == null || code.isBlank()) {
            errorResp.put("success", false);
            errorResp.put("message", "LinkedIn sign-in failed. Please try again.");
            return ResponseEntity.ok(errorResp);
        }

        // errorResp is already declared above

        // Guard: credentials not configured
        if ("NOT_SET".equals(linkedinClientId) || "NOT_SET".equals(linkedinClientSecret)) {
            errorResp.put("success", false);
            errorResp.put("message", "LinkedIn sign-in is not available in this environment. Please use email/password login.");
            return ResponseEntity.ok(errorResp);
        }

        try {
            // ── STEP 1: Exchange code for access token ──────────────────────────
            HttpHeaders tokenHeaders = new HttpHeaders();
            tokenHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            MultiValueMap<String, String> tokenBody = new LinkedMultiValueMap<>();
            tokenBody.add("grant_type",    "authorization_code");
            tokenBody.add("code",          code);
            tokenBody.add("redirect_uri",  linkedinRedirectUri);
            tokenBody.add("client_id",     linkedinClientId);
            tokenBody.add("client_secret", linkedinClientSecret);

            HttpEntity<MultiValueMap<String, String>> tokenRequest =
                new HttpEntity<>(tokenBody, tokenHeaders);

            ResponseEntity<String> tokenResponse = restTemplate.postForEntity(
                "https://www.linkedin.com/oauth/v2/accessToken",
                tokenRequest,
                String.class
            );

            JsonNode tokenJson = objectMapper.readTree(tokenResponse.getBody());
            String accessToken = tokenJson.path("access_token").asText();

            if (accessToken == null || accessToken.isBlank()) {
                // Check if LinkedIn returned an error description
                String liError = tokenJson.path("error").asText("");
                String liErrorDesc = tokenJson.path("error_description").asText("");
                String tokenErrMsg;
                if (!liError.isBlank()) {
                    tokenErrMsg = "LinkedIn sign-in failed. Please try again.";
                    System.err.println("[OAuthController] LinkedIn token error: " + liError + " - " + liErrorDesc);
                } else {
                    tokenErrMsg = "LinkedIn sign-in failed. Please try again.";
                }
                errorResp.put("success", false);
                errorResp.put("message", tokenErrMsg);
                return ResponseEntity.ok(errorResp);
            }

            // ── STEP 2: Fetch user profile using OpenID Connect userinfo ────────
            // LinkedIn supports /v2/userinfo when scope includes openid+profile+email
            HttpHeaders profileHeaders = new HttpHeaders();
            profileHeaders.setBearerAuth(accessToken);
            HttpEntity<Void> profileRequest = new HttpEntity<>(profileHeaders);

            ResponseEntity<String> profileResponse = restTemplate.exchange(
                "https://api.linkedin.com/v2/userinfo",
                HttpMethod.GET,
                profileRequest,
                String.class
            );

            JsonNode profile = objectMapper.readTree(profileResponse.getBody());

            String providerId = profile.path("sub").asText();
            String name       = profile.path("name").asText("");
            String email      = profile.path("email").asText("");

            // Fallback name from given_name + family_name
            if (name.isBlank()) {
                String given  = profile.path("given_name").asText("");
                String family = profile.path("family_name").asText("");
                name = (given + " " + family).trim();
            }

            if (email.isBlank() || providerId.isBlank()) {
                errorResp.put("success", false);
                errorResp.put("message", "Could not retrieve your LinkedIn email. Please ensure email permission is granted.");
                return ResponseEntity.ok(errorResp);
            }

            // ── STEP 3: Upsert user in DB + create session ──────────────────────
            User user = userService.oauthLoginOrRegister("LINKEDIN", providerId, name, email);
            session.setAttribute("userId",   user.getId());
            session.setAttribute("userName", user.getName());
            session.setAttribute("userPlan", user.getPlan());

            Map<String, Object> resp = new HashMap<>();
            resp.put("success", true);
            resp.put("user", userService.safeUser(user));
            return ResponseEntity.ok(resp);

        } catch (Exception ex) {
            // Never expose raw technical errors (e.g. redirect_uri_mismatch) to the frontend.
            // Log the real cause server-side, return a clean user-friendly message.
            String rawMsg = ex.getMessage() != null ? ex.getMessage().toLowerCase() : "";
            String friendlyMsg;
            if (rawMsg.contains("redirect_uri") || rawMsg.contains("redirect uri")) {
                // D_018: redirect_uri mismatch — fix in LinkedIn Developer Console. Never expose to user.
                friendlyMsg = "LinkedIn sign-in is temporarily unavailable. Please try again later or use email/password login.";
            } else if (rawMsg.contains("invalid_client") || rawMsg.contains("client_id")) {
                friendlyMsg = "LinkedIn sign-in is temporarily unavailable. Please try again later.";
            } else if (rawMsg.contains("access_denied")) {
                friendlyMsg = "LinkedIn sign-in was denied. Please allow the required permissions and try again.";
            } else if (rawMsg.contains("timeout") || rawMsg.contains("connect")) {
                friendlyMsg = "Could not reach LinkedIn. Please check your connection and try again.";
            } else {
                friendlyMsg = "LinkedIn sign-in failed. Please try again or use email/password login.";
            }
            errorResp.put("success", false);
            errorResp.put("message", friendlyMsg);
            // Log actual error server-side for debugging
            System.err.println("[OAuthController] LinkedIn OAuth error: " + ex.getMessage());
            return ResponseEntity.ok(errorResp);
        }
    }
}