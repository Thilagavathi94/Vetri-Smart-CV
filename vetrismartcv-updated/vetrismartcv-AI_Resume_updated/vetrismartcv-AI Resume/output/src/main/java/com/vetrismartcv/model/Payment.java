package com.vetrismartcv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String plan; // PRO | PREMIUM

    @Column(nullable = false)
    private Integer amount; // whole rupees (e.g. 120, not 12000) — matches dashboard/invoice display

    // Was missing — InvoiceService calls getCurrency(),
    // and the PDF invoice needs it to format the amount (e.g. "Rs." vs other symbols).
    @Builder.Default
    private String currency = "INR";

    @Column(unique = true)
    private String razorpayOrderId;

    private String razorpayPaymentId;

    @Column(length = 512)
    private String razorpaySignature;

    private String status; // CREATED | PAID | FAILED

    // MONTHLY | YEARLY — which price on the pricing-toggle the user paid.
    // Was previously always monthly since the yearly/lifetime toggle price
    // wasn't wired through to checkout at all.
    @Builder.Default
    private String billingCycle = "MONTHLY";

    // Was missing — InvoiceService.generateForPayment() and generateMissingPaidInvoicesForUser()
    // call payment.setInvoiceId(...)/getInvoiceId() to link a Payment back to the Invoice
    // generated for it, so it doesn't regenerate/duplicate an invoice on the next backfill.
    private Long invoiceId;

    private LocalDateTime createdAt;
    private LocalDateTime paidAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (status == null) status = "CREATED";
        if (currency == null) currency = "INR";
        if (billingCycle == null) billingCycle = "MONTHLY";
    }
}