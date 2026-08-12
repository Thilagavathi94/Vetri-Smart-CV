package com.vetrismartcv.repository;

import com.vetrismartcv.model.ResumeData;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ResumeRepository extends JpaRepository<ResumeData, Long> {
    List<ResumeData> findByUserIdOrderByUpdatedAtDesc(Long userId);
    List<ResumeData> findByUserIdAndStatus(Long userId, String status);
    long countByUserId(Long userId);

    /**
     * Ownership-aware lookup. Every read/update/delete/share operation on a
     * single resume MUST go through this method (or deleteByIdAndUserId)
     * instead of the plain findById()/deleteById() so that a resume ID
     * belonging to another user can never be accessed, modified, or removed
     * just because the caller happens to know or guess it.
     */
    Optional<ResumeData> findByIdAndUserId(Long id, Long userId);

    /**
     * Ownership-aware delete. Returns the number of rows deleted (0 if the
     * resume does not exist or does not belong to userId), so the caller can
     * tell the difference between "not found" and "not authorized" from the
     * service layer if desired, without ever deleting another user's resume.
     */
    long deleteByIdAndUserId(Long id, Long userId);
}