package com.vetrismartcv.service;

import com.vetrismartcv.model.ResumeData;
import com.vetrismartcv.repository.ResumeRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class ResumeService {

    @Autowired
    private ResumeRepository resumeRepository;

    /**
     * Create a new blank resume. The owner is whatever userId is set on data
     * (by the controller from the session).
     *
     * SECURITY: data.setId(null) is mandatory here. ResumeData is a JPA
     * @Entity bound directly from the request JSON, so a client could send
     * {"id": 125, ...}. Spring Data JPA's save() calls EntityManager.merge()
     * whenever the entity's id is non-null, which would silently UPDATE the
     * existing row with that id (overwriting another user's resume, and
     * reassigning its owner) instead of inserting a new one. Stripping the
     * id guarantees this method can only ever INSERT a brand new resume,
     * regardless of what id value the client supplied.
     */
    public ResumeData createResume(ResumeData data) {
        data.setId(null);
        data.setStatus("DRAFT");
        return resumeRepository.save(data);
    }

    /**
     * Save draft at any step. Only the owner of resume {@code id} may update it.
     * Returns empty if the resume does not exist or does not belong to userId,
     * so the caller can respond with 403/404 instead of silently creating or
     * overwriting a record that belongs to someone else.
     */
    public Optional<ResumeData> saveDraft(Long id, ResumeData updates, Long userId) {
        Optional<ResumeData> existing = resumeRepository.findByIdAndUserId(id, userId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        ResumeData resume = existing.get();
        mergeFields(resume, updates);
        resume.setStatus("DRAFT");
        return Optional.of(resumeRepository.save(resume));
    }

    /**
     * Save step data (partial update). Only the owner of resume {@code id} may
     * update it. Returns empty if the resume does not exist or is not owned by
     * userId.
     */
    public Optional<ResumeData> updateStep(Long id, ResumeData updates, Long userId) {
        Optional<ResumeData> existing = resumeRepository.findByIdAndUserId(id, userId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        ResumeData resume = existing.get();
        mergeFields(resume, updates);
        return Optional.of(resumeRepository.save(resume));
    }

    /**
     * Mark resume complete. Only the owner of resume {@code id} may update it.
     * Returns empty if the resume does not exist or is not owned by userId.
     */
    public Optional<ResumeData> processResume(Long id, ResumeData updates, Long userId) {
        Optional<ResumeData> existing = resumeRepository.findByIdAndUserId(id, userId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        ResumeData resume = existing.get();
        mergeFields(resume, updates);
        resume.setStatus("COMPLETE");
        return Optional.of(resumeRepository.save(resume));
    }

    /**
     * Get resume by ID, restricted to the given owner. Callers must always
     * supply the logged-in userId; there is intentionally no owner-agnostic
     * getById(id) left in this service.
     */
    public Optional<ResumeData> getById(Long id, Long userId) {
        return resumeRepository.findByIdAndUserId(id, userId);
    }

    /** Get all resumes for a user */
    public List<ResumeData> getByUserId(Long userId) {
        return resumeRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    /** Get all resumes across all users. Callers MUST verify the requester is an admin before calling this. */
    public List<ResumeData> getAll() {
        return resumeRepository.findAll();
    }

    /**
     * Update resume from review/edit page. Only the owner of resume {@code id}
     * may update it. Returns empty if the resume does not exist or is not
     * owned by userId.
     */
    public Optional<ResumeData> updateResume(Long id, ResumeData updates, Long userId) {
        Optional<ResumeData> existing = resumeRepository.findByIdAndUserId(id, userId);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        ResumeData resume = existing.get();
        mergeFields(resume, updates);
        return Optional.of(resumeRepository.save(resume));
    }

    /**
     * Delete resume. Only the owner of resume {@code id} may delete it.
     * Returns true if a resume was actually deleted, false if it did not
     * exist or was not owned by userId.
     */
    public boolean delete(Long id, Long userId) {
        return resumeRepository.deleteByIdAndUserId(id, userId) > 0;
    }

    /** Count resumes for user */
    public long countByUser(Long userId) {
        return resumeRepository.countByUserId(userId);
    }

    // ---- merge non-null fields ----
    // NOTE: userId is intentionally NEVER merged here. Resume ownership must
    // only ever be set once, by the controller, from the authenticated
    // session at creation time (see ResumeController#create). If a client
    // could send "userId" in a PUT/POST body and have it copied onto an
    // existing resume, that would let an attacker reassign a resume's
    // ownership through request JSON. The authenticated session is always
    // the source of truth for who owns a resume.
    private void mergeFields(ResumeData target, ResumeData source) {
        if (source.getJobTitle() != null)               target.setJobTitle(source.getJobTitle());
        if (source.getExperienceLevel() != null)        target.setExperienceLevel(source.getExperienceLevel());
        if (source.getExperienceJson() != null)         target.setExperienceJson(source.getExperienceJson());
        if (source.getEducationJson() != null)          target.setEducationJson(source.getEducationJson());
        if (source.getSkillsJson() != null)             target.setSkillsJson(source.getSkillsJson());
        if (source.getProjectsJson() != null)           target.setProjectsJson(source.getProjectsJson());
        if (source.getFullName() != null)               target.setFullName(source.getFullName());
        if (source.getEmail() != null)                  target.setEmail(source.getEmail());
        if (source.getPhone() != null)                  target.setPhone(source.getPhone());
        if (source.getAddress() != null)                target.setAddress(source.getAddress());
        if (source.getWebsite() != null)                target.setWebsite(source.getWebsite());
        if (source.getLinkedin() != null)               target.setLinkedin(source.getLinkedin());
        if (source.getLocation() != null)               target.setLocation(source.getLocation());
        if (source.getProfileSummary() != null)         target.setProfileSummary(source.getProfileSummary());
        if (source.getTemplateName() != null)           target.setTemplateName(source.getTemplateName());
        if (source.getIncludePhoto() != null)           target.setIncludePhoto(source.getIncludePhoto());
        if (source.getProfilePhotoData() != null)       target.setProfilePhotoData(source.getProfilePhotoData());
        if (source.getSelectedColor() != null)          target.setSelectedColor(source.getSelectedColor());
        if (source.getFontStyle() != null)              target.setFontStyle(source.getFontStyle());
        if (source.getFontFamily() != null)             target.setFontFamily(source.getFontFamily());
        if (source.getSectionSpacing() != null)         target.setSectionSpacing(source.getSectionSpacing());
        if (source.getLetterSpacing() != null)          target.setLetterSpacing(source.getLetterSpacing());
        if (source.getLineSpacing() != null)            target.setLineSpacing(source.getLineSpacing());
        if (source.getPhotoSize() != null)              target.setPhotoSize(source.getPhotoSize());
        if (source.getAdditionalSectionsJson() != null) target.setAdditionalSectionsJson(source.getAdditionalSectionsJson());
        if (source.getCertifications() != null)         target.setCertifications(source.getCertifications());
        if (source.getLanguages() != null)              target.setLanguages(source.getLanguages());
        if (source.getAwards() != null)                 target.setAwards(source.getAwards());
        if (source.getInterests() != null)              target.setInterests(source.getInterests());
        if (source.getUploadedCvParsedJson() != null)   target.setUploadedCvParsedJson(source.getUploadedCvParsedJson());
        if (source.getStatus() != null)                 target.setStatus(source.getStatus());
        if (source.getResumeName() != null)             target.setResumeName(source.getResumeName());
    }
}