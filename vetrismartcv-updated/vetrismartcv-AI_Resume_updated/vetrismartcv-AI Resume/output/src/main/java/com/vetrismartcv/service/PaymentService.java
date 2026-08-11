package com.vetrismartcv.service;

import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.Utils;
import com.vetrismartcv.model.Invoice;
import com.vetrismartcv.model.Payment;
import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.PaymentRepository;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Locale;

@Service
public class PaymentService {

    public record PaymentVerificationResult(User user, Invoice invoice) {}

    private final PaymentRepository paymentRepository;
    private final UserService userService;
    private final InvoiceService invoiceService;

    @Value("${razorpay.key-id}")
    private String keyId;

    @Value("${razorpay.key-secret}")
    private String keySecret;

    public PaymentService(
            PaymentRepository paymentRepository,
            UserService userService,
            InvoiceService invoiceService) {

        this.paymentRepository = paymentRepository;
        this.userService = userService;
        this.invoiceService = invoiceService;
    }

    public Payment createOrder(Long userId, String requestedPlan) throws Exception {

        if (keyId == null || keyId.isBlank() || keySecret == null || keySecret.isBlank()) {
            throw new IllegalStateException(
                    "Razorpay credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, then restart the app.");
        }

        String plan = requestedPlan == null
                ? ""
                : requestedPlan.trim().toUpperCase(Locale.ROOT);

        int amount;

        if ("PRO".equals(plan)) {
            amount = 12000;
        } else if ("PREMIUM".equals(plan)) {
            amount = 25000;
        } else {
            throw new IllegalArgumentException("Invalid plan.");
        }

        RazorpayClient client =
                new RazorpayClient(keyId, keySecret);

        JSONObject request = new JSONObject();

        request.put("amount", amount);
        request.put("currency", "INR");
        request.put(
                "receipt",
                "user_" + userId + "_" + System.currentTimeMillis()
        );

        Order order = client.orders.create(request);

        Payment payment = Payment.builder()
                .userId(userId)
                .plan(plan)
                .amount(amount)
                .currency("INR")
                .razorpayOrderId(order.get("id"))
                .status("CREATED")
                .build();

        return paymentRepository.save(payment);
    }

    public PaymentVerificationResult verifyPayment(
            Long userId,
            String orderId,
            String paymentId,
            String signature) throws Exception {

        Payment payment = paymentRepository
                .findByRazorpayOrderId(orderId)
                .orElseThrow(() ->
                        new IllegalArgumentException("Payment order not found."));

        if (!payment.getUserId().equals(userId)) {
            throw new SecurityException("Payment does not belong to this user.");
        }

        if ("PAID".equalsIgnoreCase(payment.getStatus())) {
            User user = userService.getById(userId)
                    .orElseThrow(() ->
                            new IllegalArgumentException("User not found."));
            Invoice invoice = ensureInvoice(payment, user);
            return new PaymentVerificationResult(user, invoice);
        }

        JSONObject options = new JSONObject();

        options.put("razorpay_order_id", orderId);
        options.put("razorpay_payment_id", paymentId);
        options.put("razorpay_signature", signature);

        boolean valid =
                Utils.verifyPaymentSignature(options, keySecret);

        if (!valid) {
            payment.setStatus("FAILED");
            paymentRepository.save(payment);

            throw new SecurityException(
                    "Payment verification failed."
            );
        }

        payment.setRazorpayPaymentId(paymentId);
        payment.setStatus("PAID");
        payment.setPaidAt(LocalDateTime.now());
        payment = paymentRepository.save(payment);

        User updatedUser = userService.upgradePlan(
                userId,
                payment.getPlan()
        );

        Invoice invoice = ensureInvoice(payment, updatedUser);

        return new PaymentVerificationResult(updatedUser, invoice);
    }

    public String getKeyId() {
        return keyId;
    }

    private Invoice ensureInvoice(Payment payment, User user) {
        Invoice invoice = invoiceService.generateForPayment(payment, user);
        if (invoice.getId() != null && !invoice.getId().equals(payment.getInvoiceId())) {
            payment.setInvoiceId(invoice.getId());
            paymentRepository.save(payment);
        }
        return invoice;
    }
}
