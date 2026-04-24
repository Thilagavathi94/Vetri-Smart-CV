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
 * Handles LinkedIn OAuth 2.0 Authorization Code flow.
 *
 * Flow:
 *   1. Frontend redirects user → LinkedIn auth URL
 *   2. LinkedIn redirects back → GET /oauth/linkedin/callback?code=...
 *   3. This controller exchanges the code for an access token
 *   4. Fetches user profile from LinkedIn API
 *   5. Creates/finds user in DB, sets session, returns JSON
 *
 * Configure in application.properties:
 *   oauth.linkedin.client-id=YOUR_CLIENT_ID
 *   oauth.linkedin.client-secret=YOUR_CLIENT_SECRET
 *   oauth.linkedin.redirect-uri=http://localhost:8080/oauth/linkedin/callback
 */
@RestController
@RequestMapping("/oauth")
public class OAuthController {

    @Autowired
    private UserService userService;

    @Value("${oauth.linkedin.client-id:NOT_SET}")
    private String linkedinClientId;

    @Value("${oauth.linkedin.client-secret:NOT_SET}")
    private String linkedinClientSecret;

    @Value("${oauth.linkedin.redirect-uri:http://localhost:8080/oauth/linkedin/callback}")
    private String linkedinRedirectUri;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * GET /oauth/linkedin/callback?code=...&state=...
     * Called by the frontend (via fetch) after LinkedIn redirects back.
     */
    @GetMapping("/linkedin/callback")
    public ResponseEntity<Map<String, Object>> linkedinCallback(
            @RequestParam String code,
            @RequestParam(required = false) String state,
            HttpSession session) {

        Map<String, Object> error = new HashMap<>();

        // Guard: credentials not configured
        if ("NOT_SET".equals(linkedinClientId) || "NOT_SET".equals(linkedinClientSecret)) {
            error.put("success", false);
            error.put("message",
                "LinkedIn OAuth not configured. Add oauth.linkedin.client-id and " +
                "oauth.linkedin.client-secret to application.properties.");
            return ResponseEntity.ok(error);
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
                error.put("success", false);
                error.put("message", "Failed to get LinkedIn access token.");
                return ResponseEntity.ok(error);
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
                error.put("success", false);
                error.put("message", "Could not retrieve your LinkedIn email. Please ensure email permission is granted.");
                return ResponseEntity.ok(error);
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
            error.put("success", false);
            error.put("message", "LinkedIn OAuth error: " + ex.getMessage());
            return ResponseEntity.ok(error);
        }
    }
}