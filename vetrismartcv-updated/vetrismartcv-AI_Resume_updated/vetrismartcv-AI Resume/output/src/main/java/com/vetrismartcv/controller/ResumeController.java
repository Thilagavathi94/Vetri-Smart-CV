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

    @Autowired
    private ResumeService resumeService;

    @Autowired
    private UserService userService;

    /* ---- POST /api/resume/create ---- */
    @PostMapping("/create")
    public ResponseEntity<ResumeData> create(
            @RequestBody ResumeData data,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) data.setUserId(userId);
        ResumeData created = resumeService.createResume(data);
        return ResponseEntity.ok(created);
    }

    /* ---- PUT /api/resume/{id}/step ---- */
    @PutMapping("/{id}/step")
    public ResponseEntity<ResumeData> updateStep(
            @PathVariable Long id,
            @RequestBody ResumeData updates) {
        return ResponseEntity.ok(resumeService.updateStep(id, updates));
    }

    /* ---- PUT /api/resume/{id}/draft ---- */
    @PutMapping("/{id}/draft")
    public ResponseEntity<ResumeData> saveDraft(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) updates.setUserId(userId);
        return ResponseEntity.ok(resumeService.saveDraft(id, updates));
    }

    /* ---- POST /api/resume/{id}/process ---- */
    @PostMapping("/{id}/process")
    public ResponseEntity<ResumeData> processResume(
            @PathVariable Long id,
            @RequestBody ResumeData updates,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId != null) updates.setUserId(userId);
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
    public ResponseEntity<ResumeData> update(
            @PathVariable Long id,
            @RequestBody ResumeData updates) {
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
        String plan = (String) session.getAttribute("userPlan");

        // Guest must log in
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                "success", false,
                "requireLogin", true,
                "message", "Please login to download."
            ));
        }

        // FREE plan can only download once
        if ("FREE".equals(plan)) {
            long count = resumeService.countByUser(userId);
            // Check how many downloads they've done
            userService.getById(userId).ifPresent(u -> {
                // allow first download
            });
        }

        userService.incrementDownload(userId);
        return ResponseEntity.ok(Map.of("success", true, "format", body.getOrDefault("format", "pdf")));
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

        List<String> skills = extractSkills(sections.get("skills"));
        if (!skills.isEmpty()) {
            parsed.put("skills", skills);
            parsed.put("skillsHint", String.join(", ", skills));
        }

        List<Map<String, String>> education = parseEducation(sections.get("education"));
        if (!education.isEmpty()) parsed.put("education", education);

        List<Map<String, String>> experience = parseExperience(sections.get("experience"));
        if (!experience.isEmpty()) parsed.put("experience", experience);

        List<Map<String, String>> projects = parseProjects(sections.get("projects"));
        if (!projects.isEmpty()) parsed.put("projects", projects);

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
            if (line.contains("@") || line.matches(".*\\d{8,}.*")) continue;
            if (line.contains(",") && line.length() < 90) return line;
        }
        return null;
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
            return String.join(" ", summaryLines.stream().limit(4).toList());
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
}
