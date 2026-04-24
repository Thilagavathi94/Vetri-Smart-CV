package com.vetrismartcv.repository;

import com.vetrismartcv.model.ResumeData;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ResumeRepository extends JpaRepository<ResumeData, Long> {
    List<ResumeData> findByUserIdOrderByUpdatedAtDesc(Long userId);
    List<ResumeData> findByUserIdAndStatus(Long userId, String status);
    long countByUserId(Long userId);
}
