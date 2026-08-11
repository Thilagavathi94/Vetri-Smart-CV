package com.vetrismartcv.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Talks to Razorpay's plain REST API directly (no razorpay-java SDK needed):
 * https://razorpay.com/docs/api/orders/create/
 * https://razorpay.com/docs/payments/server-integration/php/payment-gateway/build-integration/#3-verify-payment-signature
 */
@Service
@Slf4j
public class RazorpayService {

    private static final String ORDERS_URL = "https://api.razorpay.com/v1/orders";

    @Value("${razorpay.key-id:}")
    private String keyId;

    @Value("${razorpay.key-secret:}")
    private String keySecret;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public boolean isConfigured() {
        return keyId != null && !keyId.isBlank() && keySecret != null && !keySecret.isBlank();
    }

    public String getKeyId() {
        return keyId;
    }

    /** amountRupees is a whole-rupee amount; Razorpay expects the smallest currency unit (paise). */
    @SuppressWarnings("unchecked")
    public Map<String, Object> createOrder(int amountRupees, String receipt) throws Exception {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("amount", amountRupees * 100);
        payload.put("currency", "INR");
        payload.put("receipt", receipt);
        payload.put("payment_capture", 1);

        String body = objectMapper.writeValueAsString(payload);
        String basicAuth = Base64.getEncoder().encodeToString(
                (keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(ORDERS_URL))
                .header("Authorization", "Basic " + basicAuth)
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() >= 300) {
            log.error("Razorpay order creation failed ({}): {}", response.statusCode(), response.body());
            throw new IllegalStateException("Razorpay order creation failed: " + response.body());
        }
        return objectMapper.readValue(response.body(), Map.class);
    }

    /**
     * Verifies the HMAC-SHA256 signature Razorpay returns to the browser after checkout,
     * using our secret key server-side. This is the step that proves the payment is real
     * and wasn't spoofed by the client.
     */
    public boolean verifySignature(String orderId, String paymentId, String signature) {
        if (orderId == null || paymentId == null || signature == null) return false;
        try {
            String payload = orderId + "|" + paymentId;
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(keySecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expected = HexFormat.of().formatHex(hash);
            return expected.equalsIgnoreCase(signature.trim());
        } catch (Exception e) {
            log.error("Razorpay signature verification error", e);
            return false;
        }
    }
}