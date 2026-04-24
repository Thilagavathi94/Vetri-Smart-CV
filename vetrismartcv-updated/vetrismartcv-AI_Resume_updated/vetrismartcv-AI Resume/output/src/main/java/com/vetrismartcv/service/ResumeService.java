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

    /** Create a new blank resume */
    public ResumeData createResume(ResumeData data) {
        data.setStatus("DRAFT");
        return resumeRepository.save(data);
    }

    /** Save draft at any step */
    public ResumeData saveDraft(Long id, ResumeData updates) {
        Optional<ResumeData> existing = resumeRepository.findById(id);
        if (existing.isPresent()) {
            ResumeData resume = existing.get();
            mergeFields(resume, updates);
            resume.setStatus("DRAFT");
            return resumeRepository.save(resume);
        }
        updates.setStatus("DRAFT");
        return resumeRepository.save(updates);
    }

    /** Save step data (partial update) */
    public ResumeData updateStep(Long id, ResumeData updates) {
        Optional<ResumeData> existing = resumeRepository.findById(id);
        ResumeData resume = existing.orElse(new ResumeData());
        mergeFields(resume, updates);
        return resumeRepository.save(resume);
    }

    /** Mark resume complete */
    public ResumeData processResume(Long id, ResumeData updates) {
        Optional<ResumeData> existing = resumeRepository.findById(id);
        ResumeData resume = existing.orElse(new ResumeData());
        mergeFields(resume, updates);
        resume.setStatus("COMPLETE");
        return resumeRepository.save(resume);
    }

    /** Get resume by ID */
    public Optional<ResumeData> getById(Long id) {
        return resumeRepository.findById(id);
    }

    /** Get all resumes for a user */
    public List<ResumeData> getByUserId(Long userId) {
        return resumeRepository.findByUserIdOrderByUpdatedAtDesc(userId);
    }

    /** Get all resumes (admin) */
    public List<ResumeData> getAll() {
        return resumeRepository.findAll();
    }

    /** Update resume from review/edit page */
    public ResumeData updateResume(Long id, ResumeData updates) {
        Optional<ResumeData> existing = resumeRepository.findById(id);
        if (existing.isPresent()) {
            ResumeData resume = existing.get();
            mergeFields(resume, updates);
            return resumeRepository.save(resume);
        }
        return null;
    }

    /** Delete resume */
    public void delete(Long id) {
        resumeRepository.deleteById(id);
    }

    /** Count resumes for user */
    public long countByUser(Long userId) {
        return resumeRepository.countByUserId(userId);
    }

    // ---- merge non-null fields ----
    private void mergeFields(ResumeData target, ResumeData source) {
        if (source.getUserId() != null)                 target.setUserId(source.getUserId());
        if (source.getJobTitle() != null)               target.setJobTitle(source.getJobTitle());
        if (source.getExperienceLevel() != null)        target.setExperienceLevel(source.getExperienceLevel());
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
        if (source.getUploadedCvParsedJson() != null)   target.setUploadedCvParsedJson(source.getUploadedCvParsedJson());
        if (source.getStatus() != null)                 target.setStatus(source.getStatus());
        if (source.getResumeName() != null)             target.setResumeName(source.getResumeName());
    }
}