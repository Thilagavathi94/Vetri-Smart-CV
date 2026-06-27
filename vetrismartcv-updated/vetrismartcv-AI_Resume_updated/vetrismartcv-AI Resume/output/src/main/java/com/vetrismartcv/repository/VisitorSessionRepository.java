package com.vetrismartcv.repository;

import com.vetrismartcv.model.VisitorSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface VisitorSessionRepository extends JpaRepository<VisitorSession, Long> {
    Optional<VisitorSession> findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(String sessionId);
    List<VisitorSession> findByLoginTimeBetween(LocalDateTime from, LocalDateTime to);
    List<VisitorSession> findByLoginTimeGreaterThanEqual(LocalDateTime from);
    long countByLoginTimeBetween(LocalDateTime from, LocalDateTime to);
}
