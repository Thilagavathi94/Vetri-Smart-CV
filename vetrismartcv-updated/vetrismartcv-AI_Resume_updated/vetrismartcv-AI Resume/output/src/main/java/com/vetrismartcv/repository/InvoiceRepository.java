package com.vetrismartcv.repository;

import com.vetrismartcv.model.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    List<Invoice> findByUserIdOrderByCreatedAtDesc(Long userId);

    Optional<Invoice> findByPaymentId(Long paymentId);

    Optional<Invoice> findByIdAndUserId(Long id, Long userId);

    long countByCreatedAtBetween(java.time.LocalDateTime from, java.time.LocalDateTime to);
}