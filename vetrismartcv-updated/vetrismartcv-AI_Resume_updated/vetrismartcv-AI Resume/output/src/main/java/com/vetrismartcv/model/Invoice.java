package com.vetrismartcv.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "invoices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Human-facing invoice number, e.g. VSCV-2026-000123
    @Column(unique = true, nullable = false)
    private String invoiceNumber;

    private Long userId;

    private Long paymentId;

    private String plan;

    private Integer amount;       // amount in smallest currency unit (paise)

    private String currency;

    private String razorpayPaymentId;

    // PDF bytes stored directly in DB so it survives redeploys on Render
    // (Render's local disk is ephemeral). Swap for S3/Cloud storage later
    // if invoice volume grows large.
    // Deliberately no explicit columnDefinition so Hibernate picks the right
    // BLOB type per active DB dialect (MySQL in prod, H2 in dev/tests).
    @Lob
    @Column(name = "pdf_data")
    private byte[] pdfData;

    private LocalDateTime createdAt;

    @PrePersist
    public void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}