package com.vetrismartcv.controller;

import com.vetrismartcv.model.Invoice;
import com.vetrismartcv.model.Payment;
import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.PaymentRepository;
import com.vetrismartcv.service.InvoiceService;
import com.vetrismartcv.service.RazorpayService;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/payment")
@CrossOrigin(origins = "*")
public class PaymentController {

    // Prices in whole rupees — used only for the amount we ask Razorpay to charge.
    private static final Map<String, Integer> PLAN_PRICES = Map.of(
            "PRO", 120,
            "PREMIUM", 250
    );

    @Autowired
    private RazorpayService razorpayService;

    @Autowired
    private UserService userService;

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private InvoiceService invoiceService;

    /* ---- POST /api/payment/create-order ----
       Creates a real Razorpay order server-side. The browser never sees
       card details — Razorpay Checkout collects them on Razorpay's own
       hosted UI and only ever hands us back an order/payment id + signature. */
    @PostMapping("/create-order")
    public ResponseEntity<Map<String, Object>> createOrder(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false, "requireLogin", true, "message", "Please log in first to upgrade."));
        }
        if (!razorpayService.isConfigured()) {
            return ResponseEntity.status(503).body(Map.of(
                    "success", false,
                    "message", "Payments aren't configured on this server yet (missing RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET)."));
        }

        String plan = (body.getOrDefault("plan", "PRO")).toUpperCase(Locale.ROOT);
        Integer amountRupees = PLAN_PRICES.get(plan);
        if (amountRupees == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Unknown plan: " + plan));
        }

        try {
            String receipt = "rcpt_" + userId + "_" + System.currentTimeMillis();
            Map<String, Object> order = razorpayService.createOrder(amountRupees, receipt);

            Payment payment = Payment.builder()
                    .userId(userId)
                    .plan(plan)
                    // Store in whole rupees — this is what the invoice page and
                    // dashboard billing list both display directly with no
                    // division. Only Razorpay's own order API needs paise, and
                    // that conversion happens inside RazorpayService, not here.
                    .amount(amountRupees)
                    .currency("INR")
                    .razorpayOrderId(String.valueOf(order.get("id")))
                    .status("CREATED")
                    .build();
            paymentRepository.save(payment);

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "orderId", order.get("id"),
                    "amount", order.get("amount"),
                    "currency", order.get("currency"),
                    "keyId", razorpayService.getKeyId(),
                    "plan", plan
            ));
        } catch (Exception e) {
            return ResponseEntity.status(502).body(Map.of(
                    "success", false, "message", "Could not start payment. Please try again."));
        }
    }

    /* ---- POST /api/payment/verify ----
       Called after Razorpay Checkout succeeds in the browser. We re-derive
       the signature ourselves with our secret key and only upgrade the
       plan if it matches — the plan can never be upgraded from the client
       side alone. On success we also generate the invoice immediately,
       instead of waiting for the user to open the invoices page. */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Please log in first."));
        }

        String orderId = body.get("razorpay_order_id");
        String paymentId = body.get("razorpay_payment_id");
        String signature = body.get("razorpay_signature");
        if (orderId == null || paymentId == null || signature == null) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Missing payment details."));
        }

        Optional<Payment> paymentOpt = paymentRepository.findByRazorpayOrderId(orderId);
        if (paymentOpt.isEmpty() || !paymentOpt.get().getUserId().equals(userId)) {
            return ResponseEntity.status(404).body(Map.of("success", false, "message", "Order not found."));
        }

        Payment payment = paymentOpt.get();

        // Idempotency: if this order was already verified (e.g. handler fired twice,
        // or the user re-submitted), don't re-verify/re-upgrade — just return success.
        if ("PAID".equalsIgnoreCase(payment.getStatus())) {
            User existingUser = userService.getById(userId).orElse(null);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "plan", existingUser != null ? existingUser.getPlan() : payment.getPlan()));
        }

        boolean valid = razorpayService.verifySignature(orderId, paymentId, signature);
        if (!valid) {
            payment.setStatus("FAILED");
            paymentRepository.save(payment);
            return ResponseEntity.status(400).body(Map.of(
                    "success", false, "message", "Payment verification failed. If money was deducted, it will be auto-refunded by Razorpay."));
        }

        payment.setRazorpayPaymentId(paymentId);
        payment.setRazorpaySignature(signature);
        payment.setStatus("PAID");
        payment.setPaidAt(LocalDateTime.now());
        payment = paymentRepository.save(payment);

        User updated = userService.upgradePlan(userId, payment.getPlan());
        session.setAttribute("userPlan", updated.getPlan());

        // Generate the invoice now, instead of only lazily on a later /api/invoices call.
        try {
            Invoice invoice = invoiceService.generateForPayment(payment, updated);
            if (invoice.getId() != null && !invoice.getId().equals(payment.getInvoiceId())) {
                payment.setInvoiceId(invoice.getId());
                paymentRepository.save(payment);
            }
        } catch (RuntimeException ex) {
            // Don't fail the whole verify call over invoice PDF generation — the
            // payment is genuinely done and the plan is upgraded either way.
            // InvoiceController's backfill (generateMissingPaidInvoicesForUser)
            // will retry this the next time the user opens their invoices.
        }

        return ResponseEntity.ok(Map.of("success", true, "plan", updated.getPlan()));
    }

    /* ---- GET /api/payment/my ----
       Real billing history for the dashboard's "Billing & Invoices" section. */
    @GetMapping("/my")
    public ResponseEntity<?> myPayments(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Not logged in"));
        }
        List<Payment> payments = paymentRepository.findByUserIdAndStatusOrderByCreatedAtDesc(userId, "PAID");
        return ResponseEntity.ok(payments);
    }
}