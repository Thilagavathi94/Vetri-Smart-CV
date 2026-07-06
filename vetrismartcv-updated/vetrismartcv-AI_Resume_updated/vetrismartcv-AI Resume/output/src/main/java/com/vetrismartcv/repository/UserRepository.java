package com.vetrismartcv.repository;

import com.vetrismartcv.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    Optional<User> findByPasswordResetToken(String passwordResetToken);
    Optional<User> findByProviderAndProviderId(String provider, String providerId);
    List<User> findByNameContainingIgnoreCaseOrEmailContainingIgnoreCase(String name, String email);
    long countByCreatedAtBetween(LocalDateTime from, LocalDateTime to);
}
