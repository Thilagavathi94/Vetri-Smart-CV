package com.vetrismartcv.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "visitor_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VisitorSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    private String sessionId;

    @Column(length = 64)
    private String ipAddress;

    @Column(length = 120)
    private String city;

    @Column(length = 120)
    private String country;

    @Column(length = 160)
    private String locationLabel;

    private Double latitude;
    private Double longitude;

    @Column(length = 255)
    private String googleMapsUrl;

    @Column(length = 40)
    private String deviceType;

    @Column(length = 80)
    private String operatingSystem;

    @Column(length = 80)
    private String browserName;

    private LocalDateTime loginTime;
    private LocalDateTime logoutTime;
    private LocalDateTime lastActiveAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        if (loginTime == null) loginTime = now;
        if (lastActiveAt == null) lastActiveAt = now;
    }
}
