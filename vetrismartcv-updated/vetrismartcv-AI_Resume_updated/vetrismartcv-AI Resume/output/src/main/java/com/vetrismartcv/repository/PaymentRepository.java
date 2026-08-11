package com.vetrismartcv.repository;

import com.vetrismartcv.model.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByRazorpayOrderId(String razorpayOrderId);
    List<Payment> findByUserIdAndStatusOrderByCreatedAtDesc(Long userId, String status);
    List<Payment> findByUserIdOrderByCreatedAtDesc(Long userId);

    // Was missing — InvoiceService.generateMissingPaidInvoicesForUser() calls this,
    // and Spring Data JPA can't derive a query for a method that isn't declared here.
    // Without it the repository proxy fails to build and the app won't start.
    List<Payment> findByUserIdAndStatusIgnoreCaseOrderByPaidAtDesc(Long userId, String status);
}