package com.vetrismartcv.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "resumes")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResumeData {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Owner (null = guest/session resume)
    private Long userId;

    // Step 1 — Job Target
    private String jobTitle;

    // Step 2 — Experience Level
    private String experienceLevel;

    // Step 3 — Education (stored as JSON string)
    @Column(columnDefinition = "TEXT")
    private String educationJson;

    // Step 4 — Skills (JSON array)
    @Column(columnDefinition = "TEXT")
    private String skillsJson;

    // Step 5 — Projects
    @Column(columnDefinition = "TEXT")
    private String projectsJson;

    // Step 6 — Personal Details
    private String fullName;
    private String email;
    private String phone;
    private String address;
    private String website;
    private String linkedin;
    private String location;

    @Column(columnDefinition = "TEXT")
    private String profileSummary;

    // Profile photo (base64 or file path)
    @Column(columnDefinition = "TEXT")
    private String profilePhotoData;

    // Step 7 — Template
    private String templateName;      // minimal | modern | creative
    private Boolean includePhoto;

    // Review / Edit fields
    @Column(columnDefinition = "TEXT")
    private String selectedColor;
    private String fontStyle;         // Small | Medium | Large
    private String fontFamily;
    private String sectionSpacing;
    private String letterSpacing;
    private String lineSpacing;
    private String photoSize;         // photo diameter in px

    @Column(columnDefinition = "TEXT")
    private String additionalSectionsJson;

    // Uploaded CV parsed data
    @Column(columnDefinition = "TEXT")
    private String uploadedCvParsedJson;

    // Meta
    private String status;            // DRAFT | COMPLETE
    private String resumeName;        // user-defined resume name
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = "DRAFT";
        if (templateName == null) templateName = "minimal";
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}