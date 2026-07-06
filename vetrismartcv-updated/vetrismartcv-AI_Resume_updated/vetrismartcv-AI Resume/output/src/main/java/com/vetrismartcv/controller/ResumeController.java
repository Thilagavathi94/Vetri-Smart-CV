package com.vetrismartcv.controller;

import com.vetrismartcv.model.ResumeData;
import com.vetrismartcv.service.ResumeService;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/resume")
@CrossOrigin(origins = "*")
public class ResumeController {

    private static final Set<String> FREE_TEMPLATE_IDS = Set.of("template1", "template2", "template3");

    @Autowired
    private ResumeService resumeService;

    @Autowired
    private UserService userService;

    /* ---- POST /api/resume/create ---- */
    @PostMapping("/create")
    public ResponseEntity<?> create(
            @RequestBody ResumeData data,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) data.setUserId(userId);
        ResponseEntity<Map<String, Object>> blocked = blockFreeTemplateIfNeeded(userId, session, data.getTemplateName());
        if (blocked != null) return blocked;
        ResumeData created = resumeService.createResume(data);
        return ResponseEntity.ok(created);
    }

    /* ---- PUT /api/resume/{id}/step ---- */
    @PutMapping("/{id}/step")
    public ResponseEntity<?> updateStep(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        ResponseEntity<Map<String, Object>> blocked = blockFreeTemplateIfNeeded(userId, session, updates.getTemplateName());
        if (blocked != null) return blocked;
        return ResponseEntity.ok(resumeService.updateStep(id, updates));
    }

    /* ---- PUT /api/resume/{id}/draft ---- */
    @PutMapping("/{id}/draft")
    public ResponseEntity<?> saveDraft(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) updates.setUserId(userId);
        ResponseEntity<Map<String, Object>> blocked = blockFreeTemplateIfNeeded(userId, session, updates.getTemplateName());
        if (blocked != null) return blocked;
        return ResponseEntity.ok(resumeService.saveDraft(id, updates));
    }

    /* ---- POST /api/resume/{id}/process ---- */
    @PostMapping("/{id}/process")
    public ResponseEntity<?> processResume(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) updates.setUserId(userId);
        ResponseEntity<Map<String, Object>> blocked = blockFreeTemplateIfNeeded(userId, session, updates.getTemplateName());
        if (blocked != null) return blocked;
        return ResponseEntity.ok(resumeService.processResume(id, updates));
    }

    /* ---- GET /api/resume/{id} ---- */
    @GetMapping("/{id}")
    public ResponseEntity<ResumeData> getById(@PathVariable Long id) {
        return resumeService.getById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* ---- GET /api/resume ---- */
    @GetMapping
    public ResponseEntity<List<ResumeData>> getAll() {
        return ResponseEntity.ok(resumeService.getAll());
    }

    /* ---- GET /api/resume/my ---- */
    @GetMapping("/my")
    public ResponseEntity<?> getMyResumes(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "Not logged in"));
        return ResponseEntity.ok(resumeService.getByUserId(userId));
    }

    /* ---- PUT /api/resume/{id} ---- */
    @PutMapping("/{id}")
    public ResponseEntity<?> update(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        ResponseEntity<Map<String, Object>> blocked = blockFreeTemplateIfNeeded(userId, session, updates.getTemplateName());
        if (blocked != null) return blocked;
        ResumeData updated = resumeService.updateResume(id, updates);
        if (updated != null) return ResponseEntity.ok(updated);
        return ResponseEntity.notFound().build();
    }

    /* ---- DELETE /api/resume/{id} ---- */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        resumeService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /* ---- POST /api/resume/{id}/download ---- */
    @PostMapping("/{id}/download")
    public ResponseEntity<Map<String, Object>> trackDownload(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            HttpSession session) {

        Long userId = (Long) session.getAttribute("userId");
        String plan = getCurrentUserPlan(userId, session);

        // Guest must log in
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "requireLogin", true,
                "message", "Please login to download."
            ));
        }

        // FREE plan can only download once
        if (!isPaidPlan(plan)) {
            int downloads = userService.getById(userId)
                    .map(u -> u.getResumeDownloads() == null ? 0 : u.getResumeDownloads())
                    .orElse(0);
            if (downloads >= 1) {
                return ResponseEntity.status(403).body(Map.of(
                    "success", false,
                    "upgradeRequired", true,
                    "reason", "DOWNLOAD_LIMIT",
                    "message", "Free plan includes only one resume download. Upgrade to Pro for unlimited downloads.",
                    "pricingUrl", "/pricing"
                ));
            }
        }

        userService.incrementDownload(userId);
        return ResponseEntity.ok(Map.of("success", true, "format", body.getOrDefault("format", "pdf")));
    }

    private ResponseEntity<Map<String, Object>> blockFreeTemplateIfNeeded(Long userId, HttpSession session, String templateName) {
        String normalizedTemplate = normalizeTemplateId(templateName);
        if (normalizedTemplate.isBlank() || FREE_TEMPLATE_IDS.contains(normalizedTemplate)) return null;

        String plan = getCurrentUserPlan(userId, session);
        if (isPaidPlan(plan)) return null;

        return ResponseEntity.status(403).body(Map.of(
            "success", false,
            "upgradeRequired", true,
            "reason", "TEMPLATE_LIMIT",
            "message", "Free plan users can use only the first three templates. Upgrade to Pro to unlock all templates.",
            "pricingUrl", "/pricing"
        ));
    }

    private String getCurrentUserPlan(Long userId, HttpSession session) {
        if (userId == null) return "FREE";
        String plan = userService.getById(userId)
                .map(u -> u.getPlan() == null ? "FREE" : u.getPlan().toUpperCase(Locale.ROOT))
                .orElse("FREE");
        session.setAttribute("userPlan", plan);
        return plan;
    }

    private boolean isPaidPlan(String plan) {
        String normalized = plan == null ? "FREE" : plan.toUpperCase(Locale.ROOT);
        return "PRO".equals(normalized) || "PREMIUM".equals(normalized);
    }

    private String normalizeTemplateId(String templateName) {
        if (templateName == null) return "";
        return templateName.trim().toLowerCase(Locale.ROOT);
    }

    /* ---- POST /api/resume/upload-cv ---- */
    @PostMapping("/upload-cv")
    public ResponseEntity<Map<String, Object>> uploadCv(
            @RequestParam("file") MultipartFile file) {

        Map<String, Object> result = new HashMap<>();
        try {
            String content = extractResumeText(file);
            if (content == null || content.isBlank()) {
                throw new IllegalArgumentException("No readable text found in uploaded file");
            }
            Map<String, Object> parsed = parseResumeText(content);
            result.put("success", true);
            result.put("parsed", parsed);
            result.put("rawText", content.length() > 3000 ? content.substring(0, 3000) : content);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Could not parse file: " + e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    private String extractResumeText(MultipartFile file) throws Exception {
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        byte[] bytes = file.getBytes();

        if (originalName.endsWith(".pdf")) {
            try (PDDocument document = PDDocument.load(bytes)) {
                return new PDFTextStripper().getText(document);
            }
        }

        if (originalName.endsWith(".docx")) {
            try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes));
                 XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
                return extractor.getText();
            }
        }

        if (originalName.endsWith(".doc")) {
            try (HWPFDocument document = new HWPFDocument(new ByteArrayInputStream(bytes));
                 WordExtractor extractor = new WordExtractor(document)) {
                return extractor.getText();
            }
        }

        return new String(bytes, StandardCharsets.UTF_8);
    }

    /* ---- POST /api/resume/ai/suggestions ---- */
    @PostMapping("/ai/suggestions")
    public ResponseEntity<?> aiSuggestions(@RequestBody Map<String, String> body) {
        String type = body.getOrDefault("type", "jobTitle");
        String context = body.getOrDefault("context", "");

        Map<String, Object> response = new HashMap<>();

        switch (type) {
            case "jobTitle" -> response.put("suggestions", List.of(
                "UI Designer", "Software Developer", "Marketing Executive",
                "Data Analyst", "Customer Support", "Product Manager",
                "Full Stack Developer", "Business Analyst", "Graphic Designer",
                "Web Developer", "DevOps Engineer", "Content Writer",
                "HR Executive", "Sales Executive", "Project Manager"
            ));
            case "skills" -> {
                List<String> skills = switch (context.toLowerCase()) {
                    case "ui designer" -> List.of("Figma", "Adobe XD", "User Interface Design",
                            "Visual Design", "Prototyping", "Wireframing", "Color Theory",
                            "Typography", "Responsive Design", "Adobe Illustrator");
                    case "software developer" -> List.of("Java", "Spring Boot", "Python",
                            "JavaScript", "React", "SQL", "Git", "Docker", "REST APIs", "Microservices");
                    case "full stack developer" -> List.of("React", "Node.js", "Java", "Spring Boot",
                            "MySQL", "MongoDB", "Docker", "AWS", "Git", "REST APIs");
                    case "data analyst" -> List.of("Python", "SQL", "Tableau", "Power BI",
                            "Excel", "Statistics", "R", "Machine Learning", "Data Visualization");
                    case "web developer" -> List.of("HTML", "CSS", "JavaScript", "React",
                            "Vue.js", "Node.js", "PHP", "MySQL", "Git", "Bootstrap");
                    default -> List.of("Communication", "Problem Solving", "Teamwork",
                            "Leadership", "Time Management", "Critical Thinking",
                            "Project Management", "MS Office", "Analytical Skills");
                };
                response.put("suggestions", skills);
            }
            case "profileSummary" -> {
                // Return 3 different AI summary options
                String jobRole = context.isEmpty() ? "professional" : context;
                response.put("summaries", List.of(
                    Map.of("title", "Professional & Experienced",
                        "text", "Results-driven " + jobRole + " with a proven track record of delivering high-quality work. " +
                            "Experienced in collaborating with cross-functional teams to achieve project goals. " +
                            "Passionate about continuous learning and contributing innovative solutions."),
                    Map.of("title", "Creative & Motivated",
                        "text", "Motivated and creative " + jobRole + " with a strong passion for excellence. " +
                            "Skilled in applying best practices and modern tools to solve complex challenges. " +
                            "Eager to grow professionally and deliver impactful results in a dynamic environment."),
                    Map.of("title", "Detail-Oriented",
                        "text", "Detail-oriented " + jobRole + " with solid understanding of industry standards and emerging trends. " +
                            "Experienced in building scalable solutions and working in fast-paced environments. " +
                            "Committed to quality and continuous improvement in every project undertaken.")
                ));
            }
            default -> response.put("error", "Unknown suggestion type");
        }
        return ResponseEntity.ok(response);
    }

    // ---- Simple resume text parser ----
    private Map<String, Object> parseResumeText(String text) {
        Map<String, Object> parsed = new HashMap<>();
        String safeText = text == null ? "" : text.replace("\r", "");

        String email = firstMatch(safeText, "[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}");
        if (email != null) parsed.put("email", email);

        String phone = firstMatch(safeText, "(\\+?\\d[\\d\\s\\-()]{8,}\\d)");
        if (phone != null) parsed.put("phone", phone.trim());

        String linkedin = firstMatch(safeText, "(https?://(?:www\\.)?linkedin\\.com/[^\\s]+|linkedin\\.com/[^\\s]+)");
        if (linkedin != null) parsed.put("linkedin", linkedin.trim());

        String website = firstMatch(safeText, "(https?://(?![^\\s]*linkedin)[^\\s]+|www\\.[^\\s]+)");
        if (website != null) parsed.put("website", website.trim());

        List<String> lines = extractMeaningfulLines(safeText);
        if (!lines.isEmpty()) {
            parsed.put("fullName", lines.get(0));
        }

        String jobTitle = extractJobTitle(lines);
        if (jobTitle != null) parsed.put("jobTitle", jobTitle);

        Map<String, List<String>> sections = splitSections(lines);

        String summary = extractSummary(sections, lines);
        if (summary != null && !summary.isBlank()) parsed.put("profileSummary", summary);

        List<String> skills = extractSkillsImproved(sections.get("skills"));
        if (!skills.isEmpty()) {
            parsed.put("skills", skills);
            parsed.put("skillsHint", String.join(", ", skills));
        }

        List<Map<String, String>> education = parseEducationImproved(sections.get("education"));
        if (!education.isEmpty()) parsed.put("education", education);

        List<Map<String, String>> experience = parseExperienceImproved(sections.get("experience"));
        if (!experience.isEmpty()) parsed.put("experience", experience);

        List<Map<String, String>> projects = parseProjectsImproved(sections.get("projects"));
        if (!projects.isEmpty()) parsed.put("projects", projects);

        Map<String, List<String>> additionalSections = extractAdditionalSections(sections);
        if (!additionalSections.isEmpty()) parsed.put("additionalSections", additionalSections);

        String location = extractLocation(lines);
        if (location != null) {
            parsed.put("address", location);
            parsed.put("location", location);
        }

        parsed.put("rawPreview", safeText.substring(0, Math.min(500, safeText.length())));
        return parsed;
    }

    private String firstMatch(String text, String regex) {
        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(regex, java.util.regex.Pattern.CASE_INSENSITIVE).matcher(text);
        if (!matcher.find()) return null;
        return matcher.groupCount() >= 1 && matcher.group(1) != null ? matcher.group(1) : matcher.group();
    }

    private List<String> extractMeaningfulLines(String text) {
        List<String> lines = new ArrayList<>();
        for (String rawLine : text.split("\\n")) {
            String line = rawLine.trim().replaceAll("\\s{2,}", " ");
            if (line.isEmpty()) continue;
            lines.add(line);
        }
        return lines;
    }

    private String extractJobTitle(List<String> lines) {
        for (int i = 1; i < Math.min(lines.size(), 6); i++) {
            String line = lines.get(i);
            String lower = line.toLowerCase(Locale.ROOT);
            if (line.length() > 2 && line.length() < 70 &&
                !line.contains("@") &&
                !line.matches(".*\\d{5,}.*") &&
                !isSectionHeading(lower)) {
                return line;
            }
        }
        return null;
    }

    private String extractLocation(List<String> lines) {
        for (int i = 0; i < Math.min(lines.size(), 8); i++) {
            String line = lines.get(i);
            if (line.contains("@") || line.matches(".*\\d{8,}.*") || isSectionHeading(line) || looksLikeContactLine(line)) continue;
            if (looksLikeAddressLine(line)) return stripBullet(line);
        }
        return null;
    }

    private boolean looksLikeAddressLine(String line) {
        String value = line == null ? "" : stripBullet(line);
        String lower = value.toLowerCase(Locale.ROOT);
        if (value.length() < 4 || value.length() > 100) return false;
        if (looksLikeSentence(value)) return false;
        if (lower.matches(".*\\b(support|customer|service|expert|engineer|developer|manager|analyst|summary|profile|skill)\\b.*")) return false;

        boolean hasGeoToken = lower.matches(".*\\b(india|tamil nadu|kerala|karnataka|chennai|surandai|tenkasi|tirunelveli|coimbatore|madurai|bangalore|bengaluru|hyderabad|mumbai|delhi|pune)\\b.*");
        boolean hasAddressWord = lower.matches(".*\\b(street|road|nagar|city|district|state|pin|pincode|address|near|bus stand|complex|market)\\b.*");
        boolean hasPostalCode = value.matches(".*\\b\\d{5,6}\\b.*");
        boolean compactCommaPlace = value.contains(",") && value.split("\\s+").length <= 8;
        return hasGeoToken || hasAddressWord || hasPostalCode || compactCommaPlace;
    }

    private boolean isSectionHeading(String line) {
        String normalized = line.toLowerCase(Locale.ROOT).replace(":", "").trim();
        return normalized.equals("summary") ||
                normalized.equals("profile summary") ||
                normalized.equals("professional summary") ||
                normalized.equals("objective") ||
                normalized.equals("about me") ||
                normalized.equals("experience") ||
                normalized.equals("work experience") ||
                normalized.equals("professional experience") ||
                normalized.equals("employment") ||
                normalized.equals("contact") ||
                normalized.equals("contact information") ||
                normalized.equals("education") ||
                normalized.equals("academic background") ||
                normalized.equals("skills") ||
                normalized.equals("technical skills") ||
                normalized.equals("core skills") ||
                normalized.equals("projects") ||
                normalized.equals("personal projects");
    }

    private String mapSectionHeading(String line) {
        String normalized = line.toLowerCase(Locale.ROOT).replace(":", "").trim();
        String compact = normalized.replaceAll("\\s+", " ");
        if (Set.of("summary", "profile", "profile summary", "professional summary", "career summary", "objective", "career objective", "about me").contains(compact)) return "summary";
        if (Set.of("experience", "work experience", "professional experience", "employment", "employment history", "career history", "work history").contains(compact)) return "experience";
        if (Set.of("education", "academic background", "academics", "educational qualification", "educational qualifications", "qualification", "qualifications").contains(compact)) return "education";
        if (Set.of("skills", "technical skills", "core skills", "key skills", "professional skills", "areas of expertise", "competencies", "soft skills", "it proficiency", "technical proficiency", "computer proficiency").contains(compact)) return "skills";
        if (Set.of("projects", "project", "personal projects", "academic projects", "key projects", "project details", "academic project").contains(compact)) return "projects";
        if (Set.of("certifications", "certification", "certification details", "certificates", "licenses", "licences", "courses", "professional certifications", "certifications and licenses", "certifications and licences").contains(compact)) return "certifications";
        if (Set.of("languages", "language").contains(compact)) return "languages";
        if (Set.of("training", "trainings", "professional training", "coursework", "workshops").contains(compact)) return "training";
        if (Set.of("contact", "contact information", "personal details", "personal information").contains(compact)) return "contact";
        if (Set.of("extracurricular activities", "extra curricular activities", "activities", "achievements", "accomplishments", "awards", "honors", "honours", "publications", "interests", "hobbies").contains(compact)) return compact;
        if (normalized.equals("summary") || normalized.equals("profile summary") || normalized.equals("professional summary") || normalized.equals("objective") || normalized.equals("about me")) return "summary";
        if (normalized.equals("experience") || normalized.equals("work experience") || normalized.equals("professional experience") || normalized.equals("employment")) return "experience";
        if (normalized.equals("education") || normalized.equals("academic background")) return "education";
        if (normalized.equals("skills") || normalized.equals("technical skills") || normalized.equals("core skills")) return "skills";
        if (normalized.equals("projects") || normalized.equals("personal projects")) return "projects";
        return null;
    }

    private Map<String, List<String>> splitSections(List<String> lines) {
        Map<String, List<String>> sections = new LinkedHashMap<>();
        String current = "header";
        sections.put(current, new ArrayList<>());

        for (String line : lines) {
            String mapped = mapSectionHeading(line);
            if (mapped != null) {
                current = mapped;
                sections.putIfAbsent(current, new ArrayList<>());
                continue;
            }
            sections.computeIfAbsent(current, key -> new ArrayList<>()).add(line);
        }
        return sections;
    }

    private String extractSummary(Map<String, List<String>> sections, List<String> lines) {
        List<String> summaryLines = sections.get("summary");
        if (summaryLines != null && !summaryLines.isEmpty()) {
            return String.join(" ", summaryLines.stream()
                    .filter(line -> !looksLikeContactLine(line))
                    .limit(6)
                    .toList());
        }

        List<String> fallback = new ArrayList<>();
        for (int i = 2; i < Math.min(lines.size(), 8); i++) {
            String line = lines.get(i);
            if (isSectionHeading(line)) break;
            if (!line.contains("@") && !line.matches(".*\\d{8,}.*")) fallback.add(line);
        }
        return fallback.isEmpty() ? null : String.join(" ", fallback);
    }

    private List<String> extractSkills(List<String> skillLines) {
        if (skillLines == null || skillLines.isEmpty()) return List.of();

        LinkedHashSet<String> skills = new LinkedHashSet<>();
        for (String line : skillLines) {
            String[] parts = line.split("[,|•·]");
            for (String part : parts) {
                String skill = part.trim();
                if (skill.length() >= 2 && skill.length() <= 40) {
                    skills.add(skill);
                }
            }
        }
        return skills.stream().limit(12).toList();
    }

    private List<Map<String, String>> parseEducation(List<String> educationLines) {
        if (educationLines == null || educationLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> current = new LinkedHashMap<>();
        for (String line : educationLines) {
            if (line.length() > 100) continue;
            if (line.toLowerCase(Locale.ROOT).matches(".*(college|university|school|institute).*")) {
                if (!current.isEmpty()) items.add(current);
                current = new LinkedHashMap<>();
                current.put("school", line);
                String year = firstMatch(line, "(19|20)\\d{2}");
                if (year != null) current.put("year", year);
            } else if (!current.containsKey("degree")) {
                current.put("degree", line);
                String year = firstMatch(line, "(19|20)\\d{2}");
                if (year != null) current.putIfAbsent("year", year);
            }
        }
        if (!current.isEmpty()) items.add(current);
        return items.stream().filter(map -> !map.isEmpty()).limit(4).toList();
    }

    private List<Map<String, String>> parseExperience(List<String> experienceLines) {
        if (experienceLines == null || experienceLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> entry = new LinkedHashMap<>();
        entry.put("jobTitle", experienceLines.get(0));
        if (experienceLines.size() > 1) {
            entry.put("company", experienceLines.get(1).length() <= 80 ? experienceLines.get(1) : "");
        }
        String description = String.join(" ", experienceLines.stream().skip(2).limit(6).toList());
        if (description.isBlank() && experienceLines.size() == 1) {
            description = experienceLines.get(0);
        }
        entry.put("description", description);
        items.add(entry);
        return items;
    }

    private List<Map<String, String>> parseProjects(List<String> projectLines) {
        if (projectLines == null || projectLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        for (String line : projectLines) {
            if (line.length() < 3) continue;
            Map<String, String> item = new LinkedHashMap<>();
            item.put("title", line.length() > 80 ? line.substring(0, 80) : line);
            if (line.length() > 80) item.put("description", line);
            items.add(item);
            if (items.size() >= 4) break;
        }
        return items;
    }

    private List<String> extractSkillsImproved(List<String> skillLines) {
        if (skillLines == null || skillLines.isEmpty()) return List.of();

        LinkedHashSet<String> skills = new LinkedHashSet<>();
        for (String line : skillLines) {
            if (looksLikeContactLine(line)) continue;
            line = stripSkillCategory(line);
            if (line.isBlank()) continue;
            String[] parts = line.split("[,|/;•·\\u2022\\u00B7]|\\s{2,}");
            if (parts.length == 1 && line.length() <= 140 && !looksLikeSentence(line)) {
                parts = line.split("\\s+(?=(?:[A-Z][A-Za-z.+#-]*|REST\\b|AWS\\b|SQL\\b|HTML\\b|CSS\\b))");
            }
            for (String part : parts) {
                String skill = stripBullet(part);
                if (skill.length() >= 2 && skill.length() <= 45 && !looksLikeContactLine(skill) && !looksLikeSentence(skill) && !isSectionHeading(skill) && !looksLikeSkillCategory(skill)) {
                    skills.add(skill);
                }
            }
        }
        return skills.stream().limit(40).toList();
    }

    private String stripSkillCategory(String line) {
        String value = stripBullet(line);
        return value.replaceFirst("(?i)^(programming languages|languages|frameworks|databases|database|tools|devops|cloud|frontend|front end|backend|back end|technologies|technical skills|skills)\\s*[:\\-]\\s*", "").trim();
    }

    private boolean looksLikeSkillCategory(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT).replace(":", "").trim();
        return Set.of("programming languages", "languages", "frameworks", "databases", "database", "tools", "devops", "cloud", "frontend", "front end", "backend", "back end", "technologies", "technical skills", "skills").contains(lower);
    }

    private List<Map<String, String>> parseEducationImproved(List<String> educationLines) {
        if (educationLines == null || educationLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> current = new LinkedHashMap<>();
        for (String line : educationLines) {
            if (line.length() > 120) continue;
            String lower = line.toLowerCase(Locale.ROOT);
            String year = extractYearRange(line);
            String clean = stripBullet(removeYearText(line));
            if (lower.matches(".*(college|university|school|institute|academy|polytechnic).*")) {
                if (!current.isEmpty()) items.add(current);
                current = new LinkedHashMap<>();
                String[] degreeSchool = splitDegreeAndSchool(clean);
                if (degreeSchool[0] != null && !degreeSchool[0].isBlank()) current.put("degree", degreeSchool[0]);
                current.put("school", degreeSchool[1] != null && !degreeSchool[1].isBlank() ? degreeSchool[1] : clean);
                if (year != null) current.put("year", year);
            } else if (!current.containsKey("degree")) {
                current.put("degree", clean);
                if (year != null) current.putIfAbsent("year", year);
            } else if (year != null) {
                current.putIfAbsent("year", year);
            } else if (lower.matches(".*(cgpa|gpa|percentage|%).*")) {
                current.put("cgpa", stripBullet(line));
            }
        }
        if (!current.isEmpty()) items.add(current);
        return items.stream().filter(map -> !map.isEmpty()).limit(6).toList();
    }

    private String[] splitDegreeAndSchool(String line) {
        String[] result = new String[] { null, line };
        String[] parts = line.split("\\s*,\\s*", 2);
        if (parts.length == 2 && parts[1].toLowerCase(Locale.ROOT).matches(".*(college|university|school|institute|academy|polytechnic).*")) {
            result[0] = parts[0].trim();
            result[1] = parts[1].trim();
        }
        return result;
    }

    private String removeYearText(String line) {
        return line == null ? "" : line.replaceAll("\\(?\\b(?:19|20)\\d{2}\\b\\)?", "").replaceAll("\\s{2,}", " ").replaceAll("\\s*,\\s*$", "").trim();
    }

    private List<Map<String, String>> parseExperienceImproved(List<String> experienceLines) {
        if (experienceLines == null || experienceLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> entry = new LinkedHashMap<>();
        List<String> description = new ArrayList<>();
        for (String line : experienceLines) {
            if (line.isBlank() || looksLikeContactLine(line)) continue;
            String mappedHeading = mapSectionHeading(line);
            if (mappedHeading != null && !"experience".equals(mappedHeading)) continue;
            String clean = stripBullet(line);
            String dates = extractYearRange(clean);
            boolean dateOnly = dates != null && clean.replace(dates, "").replaceAll("[()\\-–—|,]", "").trim().isBlank();
            boolean startsNewEntry = looksLikeExperienceTitle(clean) && entry.containsKey("jobTitle") && (!description.isEmpty() || entry.containsKey("company") || entry.containsKey("startDate"));
            if (startsNewEntry) {
                entry.put("description", String.join("\n", description));
                items.add(entry);
                entry = new LinkedHashMap<>();
                description = new ArrayList<>();
            }
            if (dateOnly && !entry.isEmpty()) {
                putDateRange(entry, dates);
            } else if (!entry.containsKey("jobTitle")) {
                entry.put("jobTitle", cleanExperienceTitle(clean));
                if (dates != null) putDateRange(entry, dates);
            } else if (!entry.containsKey("company") && line.length() <= 90 && !line.startsWith("-") && !line.startsWith("•")) {
                entry.put("company", removeYearText(clean));
                if (dates != null) putDateRange(entry, dates);
            } else {
                description.add(clean);
            }
        }
        if (!entry.isEmpty()) {
            entry.put("description", String.join("\n", description));
            items.add(entry);
        }
        return items.stream().limit(8).toList();
    }

    private boolean looksLikeExperienceTitle(String line) {
        String lower = line == null ? "" : line.toLowerCase(Locale.ROOT);
        return line.length() <= 100
                && !looksLikeSentence(line)
                && lower.matches(".*\\b(developer|engineer|manager|analyst|designer|executive|consultant|intern|associate|specialist|lead|architect|administrator|tester|qa|support)\\b.*");
    }

    private String cleanExperienceTitle(String line) {
        String dates = extractYearRange(line);
        String clean = dates == null ? line : line.replace(dates, "");
        return clean.replaceAll("\\s*[-â€“â€”|,]\\s*$", "").trim();
    }

    private void putDateRange(Map<String, String> entry, String dates) {
        if (dates == null || dates.isBlank()) return;
        String clean = dates.replaceAll("\\s*to\\s*", " - ").replaceAll("\\s*[â€“â€”–-]+\\s*", " - ").trim();
        String[] parts = clean.split("\\s+-\\s+", 2);
        if (parts.length > 0 && !parts[0].isBlank()) entry.put("startDate", parts[0].trim());
        if (parts.length > 1 && !parts[1].isBlank()) entry.put("endDate", parts[1].trim());
    }

    private List<Map<String, String>> parseProjectsImproved(List<String> projectLines) {
        if (projectLines == null || projectLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> current = new LinkedHashMap<>();
        for (String line : projectLines) {
            if (line.length() < 3) continue;
            String clean = stripBullet(line);
            List<String> splitTitles = splitProjectTitles(clean);
            if (splitTitles.size() > 1) {
                if (!current.isEmpty()) {
                    items.add(current);
                    current = new LinkedHashMap<>();
                }
                for (String title : splitTitles) {
                    Map<String, String> item = new LinkedHashMap<>();
                    item.put("title", title);
                    items.add(item);
                }
                continue;
            }
            boolean newProject = current.isEmpty() || (!line.trim().startsWith("-") && !line.trim().startsWith("•") && clean.length() <= 90);
            if (newProject && !current.isEmpty()) {
                items.add(current);
                current = new LinkedHashMap<>();
            }
            if (!current.containsKey("title")) {
                current.put("title", clean.length() > 90 ? clean.substring(0, 90) : clean);
            } else {
                current.merge("description", clean, (oldVal, newVal) -> oldVal + "\n" + newVal);
            }
        }
        if (!current.isEmpty()) items.add(current);
        return items.stream().limit(12).toList();
    }

    private List<String> splitProjectTitles(String line) {
        String value = stripBullet(line);
        if (value.isBlank()) return List.of();
        List<String> simple = Arrays.stream(value.split("\\s*(?:[,;|\\u2022\\u00B7â€¢Â·]|\\s+-\\s+)\\s*"))
                .map(String::trim)
                .filter(part -> part.length() >= 3)
                .toList();
        if (simple.size() > 1) return simple;

        List<String> titles = new ArrayList<>();
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile(".+?(?:Management System|Learning Portal|Enterprise Portal|E-Commerce Platform|Portal|Platform|System|Website|Application|App)(?=\\s+[A-Z]|$)")
                .matcher(value);
        while (matcher.find()) {
            String title = matcher.group().trim();
            if (title.length() >= 3) titles.add(title);
        }
        return titles.size() > 1 ? titles : List.of(value);
    }

    private Map<String, List<String>> extractAdditionalSections(Map<String, List<String>> sections) {
        Map<String, List<String>> additional = new LinkedHashMap<>();
        for (String key : List.of("certifications", "languages", "training", "extracurricular activities",
                "extra curricular activities", "activities", "achievements", "accomplishments", "awards", "honors", "honours",
                "publications", "interests", "hobbies")) {
            List<String> values = sections.get(key);
            if (values == null || values.isEmpty()) continue;
            List<String> cleaned = values.stream()
                    .map(this::stripBullet)
                    .filter(value -> !value.isBlank())
                    .limit(20)
                    .toList();
            if (!cleaned.isEmpty()) additional.put(key, cleaned);
        }
        List<String> fallbackCerts = sections.values().stream()
                .flatMap(List::stream)
                .map(this::stripBullet)
                .filter(value -> value.length() >= 5 && value.length() <= 100)
                .filter(value -> value.toLowerCase(Locale.ROOT).matches(".*\\b(certified|certification|certificate|oracle|aws)\\b.*"))
                .filter(value -> !isSectionHeading(value) && !looksLikeContactLine(value))
                .distinct()
                .limit(10)
                .toList();
        if (!fallbackCerts.isEmpty()) {
            additional.merge("certifications", fallbackCerts, (oldVal, newVal) -> {
                LinkedHashSet<String> merged = new LinkedHashSet<>(oldVal);
                merged.addAll(newVal);
                return new ArrayList<>(merged);
            });
        }
        return additional;
    }

    private boolean looksLikeContactLine(String line) {
        String value = line == null ? "" : line.trim();
        String lower = value.toLowerCase(Locale.ROOT);
        return value.contains("@")
                || lower.contains("linkedin.com")
                || lower.matches(".*\\b(phone|mobile|email|address|contact)\\b.*")
                || value.matches(".*\\+?\\d[\\d\\s\\-()]{8,}\\d.*");
    }

    private boolean looksLikeSentence(String line) {
        String value = line == null ? "" : line.trim();
        return value.length() > 70 || value.split("\\s+").length > 7 || value.endsWith(".");
    }

    private String stripBullet(String line) {
        return line == null ? "" : line.replaceAll("^[\\s\\-•·\\u2022\\u00B7]+", "").trim();
    }

    private String extractYearRange(String line) {
        return firstMatch(line, "((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}\\s*(?:[-–—to]+\\s*((?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}|Present|Current))?");
    }
}
