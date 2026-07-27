package com.vetrismartcv.controller;

import com.vetrismartcv.model.Payment;
import com.vetrismartcv.model.User;
import com.vetrismartcv.service.PaymentService;

import jakarta.servlet.http.HttpSession;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/payment")
public class PaymentController {

    private static final Logger log = LoggerFactory.getLogger(PaymentController.class);

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/create-order")
    public ResponseEntity<Map<String, Object>> createOrder(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId =
                (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).body(
                    Map.of(
                            "success", false,
                            "message", "Please login first."
                    )
            );
        }

        try {

            Payment payment =
                    paymentService.createOrder(
                            userId,
                            body.get("plan")
                    );

            Map<String, Object> response =
                    new HashMap<>();

            response.put("success", true);
            response.put(
                    "orderId",
                    payment.getRazorpayOrderId()
            );
            response.put(
                    "amount",
                    payment.getAmount()
            );
            response.put(
                    "currency",
                    payment.getCurrency()
            );
            response.put(
                    "key",
                    paymentService.getKeyId()
            );

            return ResponseEntity.ok(response);

        } catch (IllegalArgumentException e) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "success", false,
                            "message", e.getMessage()
                    )
            );

        } catch (Exception e) {

            log.error("Unable to create Razorpay order.", e);

            return ResponseEntity.internalServerError().body(
                    Map.of(
                            "success", false,
                            "message",
                            "Unable to create payment order."
                    )
            );
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId =
                (Long) session.getAttribute("userId");

        if (userId == null) {
            return ResponseEntity.status(401).body(
                    Map.of(
                            "success", false,
                            "message", "Please login first."
                    )
            );
        }

        try {

            User updated =
                    paymentService.verifyPayment(
                            userId,
                            body.get("razorpay_order_id"),
                            body.get("razorpay_payment_id"),
                            body.get("razorpay_signature")
                    );

            session.setAttribute(
                    "userPlan",
                    updated.getPlan()
            );

            return ResponseEntity.ok(
                    Map.of(
                            "success", true,
                            "plan", updated.getPlan()
                    )
            );

        } catch (Exception e) {

            log.error("Unable to verify Razorpay payment.", e);

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "success", false,
                            "message",
                            "Payment verification failed."
                    )
            );
        }
    }
}
