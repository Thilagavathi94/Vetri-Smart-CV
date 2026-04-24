package com.vetrismartcv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;

    @Column(unique = true, nullable = false)
    private String email;

    private String password; // bcrypt hashed (null for OAuth users)

    private String provider;  // LOCAL | GOOGLE | LINKEDIN

    private String providerId; // OAuth provider user id

    private String plan;       // FREE | PRO | PREMIUM

    private Integer resumeDownloads; // count of downloads

    private String profilePicture;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (plan == null) plan = "FREE";
        if (resumeDownloads == null) resumeDownloads = 0;
        if (provider == null) provider = "LOCAL";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
