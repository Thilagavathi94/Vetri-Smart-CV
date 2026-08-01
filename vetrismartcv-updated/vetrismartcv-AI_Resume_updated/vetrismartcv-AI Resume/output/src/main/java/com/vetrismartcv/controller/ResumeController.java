package com.vetrismartcv.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vetrismartcv.model.ResumeData;
import com.vetrismartcv.service.ResumeService;
import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.apache.poi.hwpf.HWPFDocument;
import org.apache.poi.hwpf.extractor.WordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/resume")
@CrossOrigin(origins = "*")
public class ResumeController {

    private static final Set<String> FREE_TEMPLATE_IDS = Set.of("template1", "template2", "template3");
    private static final String EXPERIENCE_ROLE_WORDS =
            "developer|engineer|manager|analyst|designer|executive|consultant|intern|internship|associate|specialist|lead|"
                    + "architect|administrator|tester|qa|support|scientist|devops|full\\s*stack|backend|frontend|trainer|"
                    + "assistant|coordinator|officer|representative|supervisor|instructor|producer|editor|sales|marketing|hr";
    private static final int GEMINI_MAX_INPUT_CHARS = 24000;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    @Value("${gemini.model:gemini-1.5-flash}")
    private String geminiModel;

    @Value("${gemini.parse-enabled:true}")
    private boolean geminiParseEnabled;

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

    /* ---- GET /api/resume/latest?template=xxx ----
       Finds the current user's most recently updated resume, optionally
       filtered by template. Used by the "edit" flow on the templates page
       so a user re-opens their existing draft instead of starting over.
       (Frontend already called this URL; the endpoint was missing.) */
    @GetMapping("/latest")
    public ResponseEntity<?> getLatestResume(
            @RequestParam(required = false) String template,
            HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) return ResponseEntity.status(401).body(Map.of("error", "Not logged in"));

        List<ResumeData> resumes = resumeService.getByUserId(userId);
        String normalizedTemplate = normalizeTemplateId(template);

        Optional<ResumeData> match = resumes.stream()
                .filter(r -> normalizedTemplate.isBlank()
                        || normalizedTemplate.equalsIgnoreCase(normalizeTemplateId(r.getTemplateName())))
                .max(Comparator.comparing(
                        ResumeData::getUpdatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())));

        return match.<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
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

    /* ---- POST /api/resume/{id}/share-email ---- */
    @PostMapping("/{id}/share-email")
    public ResponseEntity<Map<String, Object>> shareByEmail(
            @PathVariable Long id,
            @RequestParam(name = "email", required = false) String rawRecipients,
            @RequestPart(name = "pdf", required = false) MultipartFile pdf,
            HttpSession session,
            HttpServletRequest request) {

        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of(
                    "success", false,
                    "requireLogin", true,
                    "message", "Please login to share your resume."
            ));
        }
        if (!userService.isEmailDeliveryConfigured()) {
            return ResponseEntity.status(503).body(Map.of(
                    "success", false,
                    "message", "Email is not configured on the server."
            ));
        }

        Optional<ResumeData> resumeOpt = resumeService.getById(id);
        if (resumeOpt.isEmpty()) {
            return ResponseEntity.status(404).body(Map.of(
                    "success", false,
                    "message", "Resume not found."
            ));
        }

        ResumeData resume = resumeOpt.get();
        List<String> recipients = parseEmailRecipients(rawRecipients);
        if (recipients.isEmpty()) {
            recipients = parseEmailRecipients(resume.getEmail());
        }
        if (recipients.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Please enter at least one valid recipient email address."
            ));
        }

        String resumeUrl = request.getScheme() + "://" + request.getServerName()
                + (request.getServerPort() > 0 ? ":" + request.getServerPort() : "")
                + "/review/" + id;

        try {
            String name = safeTrim(resume.getFullName()).isBlank() ? "My Resume" : safeTrim(resume.getFullName());
            String subject = "Resume - " + name;
            String textBody = "Hi,\n\nPlease find my resume PDF attached."
                    + "\n\nResume review link: " + resumeUrl
                    + "\n\nRegards,\n" + name + "\nVetriSmartCV";
            byte[] pdfBytes = pdf == null ? new byte[0] : pdf.getBytes();
            String attachmentName = pdf == null ? "resume.pdf" : safeTrim(pdf.getOriginalFilename());
            if (attachmentName.isBlank()) attachmentName = "resume.pdf";
            List<String> sent = new ArrayList<>();
            Map<String, String> failed = new LinkedHashMap<>();
            for (String recipient : recipients) {
                try {
                    userService.sendEmailWithAttachment(recipient, subject, textBody, pdfBytes, attachmentName, "application/pdf");
                    sent.add(recipient);
                } catch (Exception mailEx) {
                    failed.put(recipient, mailEx.getMessage() == null ? "Mail provider rejected this recipient." : mailEx.getMessage());
                }
            }
            if (!failed.isEmpty()) {
                String firstError = failed.values().iterator().next();
                return ResponseEntity.status(sent.isEmpty() ? 502 : 207).body(Map.of(
                        "success", false,
                        "sentCount", sent.size(),
                        "failedCount", failed.size(),
                        "failedRecipients", failed,
                        "message", sent.isEmpty()
                                ? firstError
                                : "Resume PDF sent to " + sent.size() + " recipient(s), but " + failed.size() + " recipient(s) failed. " + firstError
                ));
            }
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", recipients.size() == 1
                            ? "Resume PDF sent to " + recipients.get(0) + "."
                            : "Resume PDF sent to " + recipients.size() + " recipients."
            ));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of(
                    "success", false,
                    "message", "Could not send email. Please check mail configuration."
            ));
        }
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

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isValidEmail(String email) {
        return email != null && email.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private List<String> parseEmailRecipients(String raw) {
        String value = safeTrim(raw);
        if (value.isBlank()) return List.of();

        Set<String> uniqueRecipients = new LinkedHashSet<>();
        for (String part : value.split("[,;\\n\\r]+")) {
            String email = safeTrim(part).toLowerCase(Locale.ROOT);
            if (!email.isBlank()) {
                if (!isValidEmail(email)) {
                    return List.of();
                }
                uniqueRecipients.add(email);
            }
        }
        return new ArrayList<>(uniqueRecipients);
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
            String parsedWith = "normal";
            if (isGeminiParsingConfigured()) {
                try {
                    parsed = parseResumeTextWithGemini(content, parsed);
                    parsedWith = "gemini";
                } catch (Exception geminiEx) {
                    result.put("aiWarning", "Gemini parsing failed, so normal parser was used: " + geminiEx.getMessage());
                }
            }
            result.put("success", true);
            result.put("parsed", parsed);
            result.put("parsedWith", parsedWith);
            result.put("rawText", content.length() > 3000 ? content.substring(0, 3000) : content);
        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "Could not parse file: " + e.getMessage());
        }
        return ResponseEntity.ok(result);
    }

    private boolean isGeminiParsingConfigured() {
        return geminiParseEnabled && geminiApiKey != null && !geminiApiKey.isBlank();
    }

    private Map<String, Object> parseResumeTextWithGemini(String resumeText, Map<String, Object> normalFallback) throws Exception {
        String text = resumeText == null ? "" : resumeText.trim();
        if (text.length() > GEMINI_MAX_INPUT_CHARS) {
            text = text.substring(0, GEMINI_MAX_INPUT_CHARS);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(Map.of(
                "role", "user",
                "parts", List.of(Map.of("text", buildGeminiResumePrompt(text)))
        )));
        payload.put("generationConfig", Map.of(
                "temperature", 0,
                "responseMimeType", "application/json"
        ));

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                        + safeGeminiModel() + ":generateContent"))
                .timeout(Duration.ofSeconds(45))
                .header("x-goog-api-key", geminiApiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload), StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = response.body() == null ? "" : response.body();
            throw new IllegalStateException("Gemini API failed with HTTP " + response.statusCode() + ": " + body);
        }

        String jsonText = extractGeminiText(response.body());
        Map<String, Object> geminiParsed = objectMapper.readValue(cleanJsonText(jsonText), new TypeReference<>() {});
        Map<String, Object> normalized = normalizeGeminiParsedResume(geminiParsed);
        if (normalized.isEmpty()) {
            throw new IllegalStateException("Gemini returned empty resume data");
        }

        Map<String, Object> merged = new LinkedHashMap<>();
        if (normalFallback != null) merged.putAll(normalFallback);
        normalized.forEach((key, value) -> {
            if (hasResumeValue(value)) merged.put(key, value);
        });
        return merged;
    }

    private String safeGeminiModel() {
        String model = geminiModel == null ? "" : geminiModel.trim();
        return model.isBlank() ? "gemini-1.5-flash" : model;
    }

    private String buildGeminiResumePrompt(String resumeText) {
        return """
                Extract this resume into JSON only. Do not add markdown or explanation.
                Use exactly these top-level keys when data exists:
                fullName, jobTitle, email, phone, address, location, website, linkedin,
                profileSummary, skills, experience, education, projects, certifications,
                languages, additionalSections.

                Rules:
                - Do not invent missing details.
                - profileSummary must contain only the candidate summary/objective/about text.
                - skills must be an array of skill names.
                - experience must be an array of objects with jobTitle, company, startDate, endDate, description.
                - projects must be an array of objects with title, tools, description.
                - education must be an array of objects with degree, institution, year, description.
                - certifications and languages must be strings using one item per line.
                - Keep project descriptions with the correct project title.

                Resume text:
                """ + resumeText;
    }

    private String extractGeminiText(String responseBody) throws Exception {
        JsonNode root = objectMapper.readTree(responseBody);
        JsonNode parts = root.path("candidates").path(0).path("content").path("parts");
        if (!parts.isArray() || parts.isEmpty()) {
            throw new IllegalStateException("Gemini response did not include text");
        }
        StringBuilder text = new StringBuilder();
        for (JsonNode part : parts) {
            String value = part.path("text").asText("");
            if (!value.isBlank()) text.append(value);
        }
        if (text.isEmpty()) {
            throw new IllegalStateException("Gemini response text was empty");
        }
        return text.toString();
    }

    private String cleanJsonText(String value) {
        String text = value == null ? "" : value.trim();
        if (text.startsWith("```")) {
            text = text.replaceFirst("(?is)^```(?:json)?\\s*", "");
            text = text.replaceFirst("(?is)\\s*```$", "");
        }
        return text.trim();
    }

    private Map<String, Object> normalizeGeminiParsedResume(Map<String, Object> parsed) {
        if (parsed == null || parsed.isEmpty()) return Map.of();
        Object nested = parsed.get("resume");
        if (nested instanceof Map<?, ?> nestedMap) {
            parsed = stringifyKeys(nestedMap);
        }

        Map<String, Object> normalized = new LinkedHashMap<>();
        putString(normalized, "fullName", parsed);
        putString(normalized, "jobTitle", parsed);
        putString(normalized, "email", parsed);
        putString(normalized, "phone", parsed);
        putString(normalized, "address", parsed);
        putString(normalized, "location", parsed);
        putString(normalized, "website", parsed);
        putString(normalized, "linkedin", parsed);
        putString(normalized, "profileSummary", parsed);
        putStringOrJoined(normalized, "certifications", parsed);
        putStringOrJoined(normalized, "languages", parsed);

        Object skills = parsed.get("skills");
        if (skills instanceof Collection<?> values) {
            List<String> cleanSkills = values.stream()
                    .map(value -> value == null ? "" : String.valueOf(value).trim())
                    .filter(value -> !value.isBlank())
                    .distinct()
                    .limit(80)
                    .toList();
            if (!cleanSkills.isEmpty()) normalized.put("skills", cleanSkills);
        } else if (skills instanceof String textValue && !textValue.isBlank()) {
            normalized.put("skills", Arrays.stream(textValue.split("[,\\n;|]+"))
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .distinct()
                    .limit(80)
                    .toList());
        }

        putObjectList(normalized, "experience", parsed);
        putObjectList(normalized, "education", parsed);
        putObjectList(normalized, "projects", parsed);

        Object additional = parsed.get("additionalSections");
        if (additional instanceof Map<?, ?> map && !map.isEmpty()) {
            normalized.put("additionalSections", stringifyKeys(map));
        }
        return normalized;
    }

    private Map<String, Object> stringifyKeys(Map<?, ?> source) {
        Map<String, Object> result = new LinkedHashMap<>();
        source.forEach((key, value) -> {
            if (key != null) result.put(String.valueOf(key), value);
        });
        return result;
    }

    private void putString(Map<String, Object> target, String key, Map<String, Object> source) {
        Object value = source.get(key);
        if (value instanceof String text && !text.trim().isBlank()) {
            target.put(key, text.trim());
        }
    }

    private void putStringOrJoined(Map<String, Object> target, String key, Map<String, Object> source) {
        Object value = source.get(key);
        if (value instanceof String text && !text.trim().isBlank()) {
            target.put(key, text.trim());
        } else if (value instanceof Collection<?> values) {
            String joined = values.stream()
                    .map(item -> item == null ? "" : String.valueOf(item).trim())
                    .filter(item -> !item.isBlank())
                    .reduce((left, right) -> left + "\n" + right)
                    .orElse("");
            if (!joined.isBlank()) target.put(key, joined);
        }
    }

    private void putObjectList(Map<String, Object> target, String key, Map<String, Object> source) {
        Object value = source.get(key);
        if (!(value instanceof Collection<?> values)) return;
        List<Map<String, Object>> cleaned = new ArrayList<>();
        for (Object item : values) {
            if (!(item instanceof Map<?, ?> map)) continue;
            Map<String, Object> entry = stringifyKeys(map);
            entry.entrySet().removeIf(e -> e.getValue() == null || String.valueOf(e.getValue()).trim().isBlank());
            if (!entry.isEmpty()) cleaned.add(entry);
        }
        if (!cleaned.isEmpty()) target.put(key, cleaned);
    }

    private boolean hasResumeValue(Object value) {
        if (value == null) return false;
        if (value instanceof String text) return !text.trim().isBlank();
        if (value instanceof Collection<?> values) return !values.isEmpty();
        if (value instanceof Map<?, ?> map) return !map.isEmpty();
        return true;
    }

    private String extractResumeText(MultipartFile file) throws Exception {
        String originalName = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(Locale.ROOT);
        byte[] bytes = file.getBytes();

        if (originalName.endsWith(".pdf")) {
            try (PDDocument document = PDDocument.load(bytes)) {
                return extractPdfTextColumnAware(document);
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

    // =====================================================================
    // Column-aware PDF extraction
    //
    // Many resume templates render a two-column layout (a narrow sidebar with
    // contact/skills/languages next to a wider main content column). The
    // default PDFTextStripper reads characters roughly left-to-right, top-to-
    // bottom across the FULL page width, so text belonging to the sidebar and
    // text belonging to the main column that happen to sit at a similar
    // vertical position get merged into the same "line" and even split mid
    // word (e.g. "Octo" from one column ends up glued to "ber 2023" from the
    // other). This produces the missing-section / merged-experience bugs.
    //
    // Fix: capture every character's (page, x, y) position ourselves, cluster
    // characters into real visual lines, detect whether the page has two
    // (or more) distinct horizontal bands of content separated by a gap
    // (i.e. columns), and if so extract each column FULLY and INDEPENDENTLY,
    // top-to-bottom, before concatenating them. Single-column resumes are
    // left completely untouched (no gap is found, so we fall back to plain
    // top-to-bottom reading order).
    // =====================================================================

    private static final float LINE_Y_TOLERANCE = 3.0f;   // px tolerance to treat chars as same line
    private static final float MIN_COLUMN_GAP = 18.0f;    // minimum blank gap (px) to call it a column break
    private static final int MIN_LINES_PER_COLUMN = 3;    // avoid false-positive column splits on noise

    private static final class CharSpan {
        final int page;
        final float x;
        final float y;
        final float endX;
        final String ch;

        CharSpan(int page, float x, float y, float endX, String ch) {
            this.page = page;
            this.x = x;
            this.y = y;
            this.endX = endX;
            this.ch = ch;
        }
    }

    private static final class PdfLine {
        float minX;
        float maxX;
        float y;
        final StringBuilder text = new StringBuilder();
    }

    private static final class ColumnCollectingStripper extends PDFTextStripper {
        final List<CharSpan> spans = new ArrayList<>();

        ColumnCollectingStripper() throws java.io.IOException {
            super();
            setSortByPosition(false); // we do our own position-based reconstruction
        }

        @Override
        protected void processTextPosition(TextPosition text) {
            spans.add(new CharSpan(
                    getCurrentPageNo(),
                    text.getXDirAdj(),
                    text.getYDirAdj(),
                    text.getXDirAdj() + text.getWidthDirAdj(),
                    text.getUnicode()));
            super.processTextPosition(text);
        }
    }

    private String extractPdfTextColumnAware(PDDocument document) throws Exception {
        ColumnCollectingStripper collector = new ColumnCollectingStripper();
        collector.setStartPage(1);
        collector.setEndPage(document.getNumberOfPages());
        collector.getText(document); // triggers processTextPosition callbacks; string result unused

        if (collector.spans.isEmpty()) {
            // Fallback: no positional data available, use plain stripper
            return new PDFTextStripper().getText(document);
        }

        Map<Integer, List<CharSpan>> byPage = new TreeMap<>();
        for (CharSpan span : collector.spans) {
            byPage.computeIfAbsent(span.page, k -> new ArrayList<>()).add(span);
        }

        StringBuilder fullText = new StringBuilder();
        for (Map.Entry<Integer, List<CharSpan>> pageEntry : byPage.entrySet()) {
            int pageIndex = pageEntry.getKey();
            List<PdfLine> lines = buildLines(pageEntry.getValue());
            if (lines.isEmpty()) continue;

            PDPage pdPage = document.getPage(pageIndex - 1);
            float pageWidth = pdPage.getMediaBox().getWidth();

            String pageText = renderPageInColumnOrder(lines, pageWidth);
            if (fullText.length() > 0) fullText.append("\n\n");
            fullText.append(pageText);
        }
        return fullText.toString();
    }

    /** Cluster raw characters (already ordered by page-stream position) into visual lines using Y proximity. */
    private List<PdfLine> buildLines(List<CharSpan> pageSpans) {
        List<CharSpan> sorted = new ArrayList<>(pageSpans);
        sorted.sort(Comparator.comparing((CharSpan s) -> s.y).thenComparing(s -> s.x));

        List<PdfLine> lines = new ArrayList<>();
        List<CharSpan> currentGroup = new ArrayList<>();
        float currentY = Float.NaN;

        for (CharSpan span : sorted) {
            if (Float.isNaN(currentY) || Math.abs(span.y - currentY) <= LINE_Y_TOLERANCE) {
                currentGroup.add(span);
                currentY = Float.isNaN(currentY) ? span.y : currentY;
            } else {
                lines.add(finishLine(currentGroup));
                currentGroup = new ArrayList<>();
                currentGroup.add(span);
                currentY = span.y;
            }
        }
        if (!currentGroup.isEmpty()) lines.add(finishLine(currentGroup));
        return lines;
    }

    private PdfLine finishLine(List<CharSpan> group) {
        group.sort(Comparator.comparing(s -> s.x));
        PdfLine line = new PdfLine();
        line.minX = group.get(0).x;
        line.maxX = group.get(group.size() - 1).endX;
        line.y = group.get(0).y;
        float prevEndX = -1;
        for (CharSpan span : group) {
            // insert a space if there's a visible horizontal gap between characters (word boundary)
            if (prevEndX >= 0 && span.x - prevEndX > 1.5f && line.text.length() > 0
                    && line.text.charAt(line.text.length() - 1) != ' ') {
                line.text.append(' ');
            }
            line.text.append(span.ch);
            prevEndX = span.endX;
        }
        return line;
    }

    /**
     * Detects whether a page is laid out in two (or more) columns by looking for a
     * consistent horizontal gap that separates the left-starting-X of lines into
     * distinct clusters. If found, each column is emitted in full, top-to-bottom,
     * widest/most-content column first (main body), narrower column after (sidebar).
     * If no clear column gap is found, the page is treated as a single column and
     * lines are simply emitted in natural top-to-bottom order.
     */
    private String renderPageInColumnOrder(List<PdfLine> lines, float pageWidth) {
        List<Float> startXs = lines.stream()
                .map(l -> l.minX)
                .sorted()
                .distinct()
                .toList();

        Float boundary = detectColumnBoundary(startXs, pageWidth);
        if (boundary == null) {
            lines.sort(Comparator.comparing(l -> l.y));
            return joinLines(lines);
        }

        List<PdfLine> left = new ArrayList<>();
        List<PdfLine> right = new ArrayList<>();
        for (PdfLine line : lines) {
            if (line.minX < boundary) left.add(line);
            else right.add(line);
        }
        if (left.size() < MIN_LINES_PER_COLUMN || right.size() < MIN_LINES_PER_COLUMN) {
            lines.sort(Comparator.comparing(l -> l.y));
            return joinLines(lines);
        }

        left.sort(Comparator.comparing(l -> l.y));
        right.sort(Comparator.comparing(l -> l.y));

        double leftAvgWidth = left.stream().mapToDouble(l -> l.maxX - l.minX).average().orElse(0);
        double rightAvgWidth = right.stream().mapToDouble(l -> l.maxX - l.minX).average().orElse(0);

        List<PdfLine> primary = leftAvgWidth >= rightAvgWidth ? left : right;
        List<PdfLine> secondary = leftAvgWidth >= rightAvgWidth ? right : left;

        StringBuilder result = new StringBuilder();
        result.append(joinLines(primary));
        result.append("\n\n");
        result.append(joinLines(secondary));
        return result.toString();
    }

    private String joinLines(List<PdfLine> lines) {
        StringBuilder sb = new StringBuilder();
        for (PdfLine line : lines) {
            if (sb.length() > 0) sb.append("\n");
            sb.append(line.text.toString().replaceAll("\\s{2,}", " ").trim());
        }
        return sb.toString();
    }

    private Float detectColumnBoundary(List<Float> sortedDistinctStartXs, float pageWidth) {
        if (sortedDistinctStartXs.size() < 2) return null;
        float bestGap = 0f;
        float bestBoundary = -1f;
        for (int i = 1; i < sortedDistinctStartXs.size(); i++) {
            float gap = sortedDistinctStartXs.get(i) - sortedDistinctStartXs.get(i - 1);
            if (gap > bestGap) {
                bestGap = gap;
                bestBoundary = (sortedDistinctStartXs.get(i) + sortedDistinctStartXs.get(i - 1)) / 2f;
            }
        }
        if (bestGap < MIN_COLUMN_GAP) return null;
        // Avoid treating a gap right at the page edges as a real column split
        if (bestBoundary < pageWidth * 0.15f || bestBoundary > pageWidth * 0.85f) return null;
        return bestBoundary;
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
        String candidateName = extractCandidateName(lines);
        if (candidateName != null) {
            parsed.put("fullName", candidateName);
        }

        String jobTitle = extractJobTitle(lines);
        if (jobTitle != null) parsed.put("jobTitle", jobTitle);

        Map<String, List<String>> sections = splitSections(lines);
        repairLeakedResumeSections(sections);

        String summary = extractSummary(sections, lines);
        if (summary != null && !summary.isBlank()) parsed.put("profileSummary", summary);

        List<String> skills = extractSkillsImproved(sections.get("skills"));
        if (skills.isEmpty()) {
            String headerSkillsLine = findHeaderSkillsLine(lines);
            if (headerSkillsLine != null) skills = extractSkillsImproved(List.of(headerSkillsLine));
        }
        if (!skills.isEmpty()) {
            parsed.put("skills", skills);
            parsed.put("skillsHint", String.join(", ", skills));
        }

        List<Map<String, String>> education = parseEducationImproved(sections.get("education"));
        if (!education.isEmpty()) parsed.put("education", education);

        List<Map<String, String>> experience = repairExperienceDateTitleRows(parseExperienceImproved(sections.get("experience")));
        if (!experience.isEmpty()) parsed.put("experience", experience);

        List<Map<String, String>> projects = parseProjectsImprovedV2(sections.get("projects"));
        if (!projects.isEmpty()) parsed.put("projects", projects);

        Map<String, List<String>> additionalSections = extractAdditionalSections(sections);
        if (!additionalSections.isEmpty()) {
            parsed.put("additionalSections", additionalSections);
            List<String> certifications = additionalSections.get("certifications");
            if (certifications != null && !certifications.isEmpty()) {
                parsed.put("certifications", String.join("\n", certifications));
            }
            List<String> languages = additionalSections.get("languages");
            if (languages != null && !languages.isEmpty()) {
                parsed.put("languages", String.join(", ", languages));
            }
        }

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

    private String extractCandidateName(List<String> lines) {
        if (lines == null || lines.isEmpty()) return null;
        for (int i = 0; i < Math.min(lines.size(), 15); i++) {
            String line = stripBullet(lines.get(i)).replaceAll("\\s+", " ").trim();
            if (line.isBlank() || looksLikeBadNameLine(line)) continue;
            String beforeComma = line.split("\\s*,\\s*", 2)[0].trim();
            String candidate = beforeComma;
            if (candidate.matches("[A-Za-z][A-Za-z'.-]+(?:\\s+[A-Za-z][A-Za-z'.-]+){1,4}")) return candidate;
            java.util.regex.Matcher matcher = java.util.regex.Pattern
                    .compile("\\b([A-Z][A-Z'.-]+(?:\\s+[A-Z][A-Z'.-]+){1,4})\\b")
                    .matcher(line);
            if (matcher.find()) {
                candidate = matcher.group(1).replaceAll("\\s+", " ").trim();
                if (!looksLikeBadNameLine(candidate)) return candidate;
            }
        }
        return null;
    }

    private boolean looksLikeBadNameLine(String line) {
        String value = line == null ? "" : line.trim();
        String lower = value.toLowerCase(Locale.ROOT);
        if (value.isBlank() || value.length() > 90) return true;
        if (looksLikeContactLine(value) || isSectionHeading(value) || looksLikeSkillsLine(value)) return true;
        if (value.matches(".*\\d.*") || value.contains("|") || value.contains(":")) return true;
        if (looksLikeSentence(value)) return true;
        return lower.matches(".*\\b(details|nationality|driving licen[sc]e|place of birth|links|resume templates|build this template|education|skills|profile|summary|employment history|experience|certifications?)\\b.*");
    }

    private String extractJobTitle(List<String> lines) {
        for (int i = 0; i < Math.min(lines.size(), 12); i++) {
            String line = stripBullet(lines.get(i)).replaceAll("\\s+", " ").trim();
            String lower = line.toLowerCase(Locale.ROOT);
            if (line.contains(",")) {
                String[] parts = line.split("\\s*,\\s*", 2);
                if (parts.length == 2 && looksLikeJobTitleLine(parts[1])) return parts[1].trim();
            }
            if (line.length() > 2 && line.length() < 90 &&
                !line.contains("@") &&
                !line.matches(".*\\d{5,}.*") &&
                !isSectionHeading(lower) &&
                !looksLikeBadNameLine(line) &&
                !looksLikeSkillsLine(line) &&
                looksLikeJobTitleLine(line)) {
                return line;
            }
        }
        return null;
    }

    private boolean looksLikeJobTitleLine(String line) {
        String value = line == null ? "" : stripBullet(line).trim();
        String lower = value.toLowerCase(Locale.ROOT);
        if (value.isBlank() || looksLikeSentence(value)) return false;
        if (lower.matches(".*\\b(profile|summary|objective|experience|education|skills|competenc(?:y|ies)|project|certification|contact|language|tool|technology|details|nationality|driving licen[sc]e|place of birth|links)\\b.*")) return false;
        return lower.matches(".*\\b(" + EXPERIENCE_ROLE_WORDS + ")\\b.*");
    }

    private boolean looksLikeSkillsLine(String line) {
        String value = line == null ? "" : line.trim();
        if (value.isEmpty()) return false;
        if (value.matches("(?i)^(frontend|front end|backend|back end|full\\s*stack|tech\\s*stack|stack|"
                + "programming languages|languages|frameworks|databases?|tools|devops|cloud|"
                + "technologies|technical skills|skills|core competencies)\\s*[:\\-].*")) return true;
        long commaCount = value.chars().filter(ch -> ch == ',').count();
        return value.contains(":") && commaCount >= 2;
    }

    private String findHeaderSkillsLine(List<String> lines) {
        for (int i = 1; i < Math.min(lines.size(), 8); i++) {
            String line = lines.get(i);
            if (looksLikeSkillsLine(line)) return line;
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
        boolean compactCommaPlace = !value.contains(":") && value.contains(",") && value.split("\\s+").length <= 8 && !value.matches(".*\\b[A-Z]{2,}\\b.*");
        return hasGeoToken || hasAddressWord || hasPostalCode || compactCommaPlace;
    }

    private boolean isSectionHeading(String line) {
        return mapSectionHeading(line) != null;
    }

    private String mapSectionHeading(String line) {
        String normalized = line.toLowerCase(Locale.ROOT).replace(":", "").trim();
        String compact = normalized.replaceAll("\\s+", " ");
        if (Set.of("summary", "profile", "profile summary", "professional summary", "career summary", "objective", "career objective", "about me").contains(compact)) return "summary";
        if (Set.of("experience", "work experience", "professional experience", "employment", "employment history", "career history", "work history",
                "internship", "internships", "industrial training", "professional internship", "internship experience",
                "roles and responsibilities", "responsibilities").contains(compact)) return "experience";
        if (Set.of("education", "academic background", "academics", "educational qualification", "educational qualifications", "qualification", "qualifications").contains(compact)) return "education";
        if (Set.of("skills", "technical skills", "core skills", "key skills", "professional skills", "areas of expertise", "competencies", "soft skills", "it proficiency", "technical proficiency", "computer proficiency").contains(compact)) return "skills";
        if (Set.of("projects", "project", "personal projects", "academic projects", "key projects", "project details", "academic project",
                "project experience", "internship projects", "major projects", "minor projects").contains(compact)) return "projects";
        if (Set.of("certifications", "certification", "certification details", "certificates", "licenses", "licences", "courses", "professional certifications", "certifications and licenses", "certifications and licences").contains(compact)) return "certifications";
        if (Set.of("languages", "language").contains(compact)) return "languages";
        if (Set.of("training", "trainings", "professional training", "coursework", "workshops").contains(compact)) return "training";
        if (Set.of("contact", "contact information", "personal details", "personal information", "details", "links", "driving license",
                "driving licence", "place of birth", "nationality").contains(compact)) return "contact";
        if (Set.of("extracurricular activities", "extra curricular activities", "extra-curricular", "extra-curricular activities",
                "extracurricular", "co-curricular activities", "co curricular activities", "activities", "achievements",
                "accomplishments", "awards", "honors", "honours", "publications", "interests", "hobbies").contains(compact)) return compact;
        if (normalized.equals("summary") || normalized.equals("profile summary") || normalized.equals("professional summary") || normalized.equals("objective") || normalized.equals("about me")) return "summary";
        if (normalized.equals("experience") || normalized.equals("work experience") || normalized.equals("professional experience") || normalized.equals("employment") || normalized.equals("internship")) return "experience";
        if (normalized.equals("education") || normalized.equals("academic background")) return "education";
        if (normalized.equals("skills") || normalized.equals("technical skills") || normalized.equals("core skills")) return "skills";
        if (normalized.equals("projects") || normalized.equals("personal projects")) return "projects";
        return null;
    }

    private String[] splitInlineSectionHeading(String line) {
        String value = line == null ? "" : line.trim();
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile("(?i)^(profile\\s+summary|professional\\s+summary|career\\s+summary|summary|objective|about\\s+me|work\\s+experience|professional\\s+experience|experience|employment\\s+history|employment|internships?|internship\\s+experience|roles\\s+and\\s+responsibilities|responsibilities|education|academic\\s+background|technical\\s+skills|core\\s+skills|key\\s+skills|skills|projects?|academic\\s+projects|personal\\s+projects|project\\s+experience|internship\\s+projects|major\\s+projects|minor\\s+projects|certifications?|certificates|licenses|licences|courses|languages?|extra\\s*[- ]?curricular(?:\\s+activities)?|co\\s*[- ]?curricular(?:\\s+activities)?|activities|achievements|accomplishments|interests|hobbies|details|links|nationality|driving\\s+licen[sc]e|place\\s+of\\s+birth)\\b\\s*[:\\-]?\\s*(.*)$")
                .matcher(value);
        if (!matcher.matches()) return null;
        String mapped = mapSectionHeading(matcher.group(1));
        if (mapped == null) return null;
        String afterHeading = value.substring(matcher.end(1)).trim();
        if (afterHeading.matches("^[,;|].*")) return null;
        return new String[] { mapped, matcher.group(2) == null ? "" : matcher.group(2).trim() };
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
            String[] inlineHeading = splitInlineSectionHeading(line);
            if (inlineHeading != null) {
                current = inlineHeading[0];
                sections.putIfAbsent(current, new ArrayList<>());
                if (!inlineHeading[1].isBlank()) {
                    sections.get(current).add(inlineHeading[1]);
                }
                continue;
            }
            sections.computeIfAbsent(current, key -> new ArrayList<>()).add(line);
        }
        return sections;
    }

    private void repairLeakedResumeSections(Map<String, List<String>> sections) {
        if (sections == null || sections.isEmpty()) return;
        for (String source : new ArrayList<>(sections.keySet())) {
            List<String> values = sections.get(source);
            if (values == null || values.isEmpty()) continue;
            List<String> kept = new ArrayList<>();
            String current = source;
            for (String value : values) {
                String mapped = mapSectionHeading(value);
                if (mapped != null) {
                    current = mapped;
                    sections.putIfAbsent(current, new ArrayList<>());
                    continue;
                }
                if (current.equals(source)) {
                    kept.add(value);
                } else {
                    sections.computeIfAbsent(current, key -> new ArrayList<>()).add(value);
                }
            }
            sections.put(source, kept);
        }
    }

    private String extractSummary(Map<String, List<String>> sections, List<String> lines) {
        List<String> summaryLines = sections.get("summary");
        if (summaryLines != null && !summaryLines.isEmpty()) {
            List<String> cleaned = summaryLines.stream()
                    .map(this::stripBullet)
                    .filter(line -> !line.isBlank())
                    .filter(line -> !looksLikeContactLine(line) && !looksLikeSidebarDetailLine(line))
                    .takeWhile(line -> mapSectionHeading(line) == null)
                    .limit(10)
                    .toList();
            String summary = String.join(" ", cleaned).trim();
            String headingSummary = extractSectionTextBetweenHeadings(lines, "summary");
            if (!headingSummary.isBlank() && (summary.isBlank() || headingSummary.length() > summary.length() || startsLikeContinuation(summary))) {
                return headingSummary;
            }
            if (!summary.isBlank()) return summary;
        }

        List<String> fallback = new ArrayList<>();
        for (int i = 0; i < Math.min(lines.size(), 18); i++) {
            String line = lines.get(i);
            if (isSectionHeading(line)) break;
            if (looksLikeContactLine(line) || looksLikeSidebarDetailLine(line) || looksLikeBadNameLine(line) || looksLikeJobTitleLine(line)) continue;
            if (looksLikeSentence(line) || line.toLowerCase(Locale.ROOT).matches(".*\\b(experience|seeking|expert|skilled|specialized|professional|designer|developer|engineer|assistant)\\b.*")) {
                fallback.add(stripBullet(line));
                if (fallback.size() >= 3) break;
            }
        }
        return fallback.isEmpty() ? null : String.join(" ", fallback);
    }

    private String extractSectionTextBetweenHeadings(List<String> lines, String targetSection) {
        if (lines == null || lines.isEmpty()) return "";
        List<String> values = new ArrayList<>();
        boolean collecting = false;
        for (String line : lines) {
            String mapped = mapSectionHeading(line);
            if (mapped != null) {
                if (collecting && !targetSection.equals(mapped)) break;
                collecting = targetSection.equals(mapped);
                continue;
            }
            String[] inlineHeading = splitInlineSectionHeading(line);
            if (inlineHeading != null) {
                if (collecting && !targetSection.equals(inlineHeading[0])) break;
                collecting = targetSection.equals(inlineHeading[0]);
                if (collecting && !inlineHeading[1].isBlank()) values.add(inlineHeading[1]);
                continue;
            }
            if (collecting) {
                String clean = stripBullet(line);
                if (!clean.isBlank() && !looksLikeContactLine(clean) && !looksLikeSidebarDetailLine(clean)) {
                    values.add(clean);
                }
            }
        }
        return String.join(" ", values).replaceAll("\\s{2,}", " ").trim();
    }

    private boolean startsLikeContinuation(String value) {
        String text = value == null ? "" : value.trim();
        if (text.isBlank()) return false;
        char first = text.charAt(0);
        return Character.isLowerCase(first) || text.toLowerCase(Locale.ROOT).matches("^(and|or|with|using|deploying|developing|building)\\b.*");
    }

    private boolean looksLikeSidebarDetailLine(String line) {
        String lower = line == null ? "" : stripBullet(line).toLowerCase(Locale.ROOT);
        return lower.matches(".*\\b(details|nationality|american|driving licen[sc]e|full|place of birth|links|resume templates|build this template|pinterest)\\b.*")
                || lower.matches(".*\\b\\d{3,}.*")
                || lower.matches(".*\\b(street|avenue|ave|los angeles|new york|united states|san antonio)\\b.*");
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
                String[] degreeSchool = splitDegreeAndSchool(clean);
                if (!current.isEmpty() && !current.containsKey("school")) {
                    if (degreeSchool[0] != null && !degreeSchool[0].isBlank() && !current.containsKey("degree")) current.put("degree", degreeSchool[0]);
                    current.put("school", degreeSchool[1] != null && !degreeSchool[1].isBlank() ? degreeSchool[1] : clean);
                } else {
                    if (!current.isEmpty()) items.add(current);
                    current = new LinkedHashMap<>();
                    if (degreeSchool[0] != null && !degreeSchool[0].isBlank()) current.put("degree", degreeSchool[0]);
                    current.put("school", degreeSchool[1] != null && !degreeSchool[1].isBlank() ? degreeSchool[1] : clean);
                }
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
        return items.stream().filter(map -> !map.isEmpty()).limit(12).toList();
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
        for (String line : expandEmbeddedExperienceLines(experienceLines)) {
            if (line.isBlank() || looksLikeContactLine(line)) continue;
            String mappedHeading = mapSectionHeading(line);
            if (mappedHeading != null && !"experience".equals(mappedHeading)) continue;
            String clean = stripBullet(line);
            if (clean.isBlank()) continue;
            String dates = extractYearRange(clean);
            boolean dateOnly = dates != null && clean.replace(dates, "").replaceAll("[()\\-–—|,]", "").trim().isBlank();
            boolean startsNewEntry = (looksLikeExperienceTitle(clean) || !parseCompactExperienceHeader(clean).isEmpty())
                    && entry.containsKey("jobTitle")
                    && (!description.isEmpty() || entry.containsKey("company") || entry.containsKey("startDate"));
            if (startsNewEntry) {
                entry.put("description", String.join("\n", description));
                items.add(entry);
                entry = new LinkedHashMap<>();
                description = new ArrayList<>();
            }
            if (!entry.containsKey("jobTitle")) {
                Map<String, String> compact = parseCompactExperienceHeader(clean);
                if (!compact.isEmpty()) {
                    entry.putAll(compact);
                } else {
                    entry.put("jobTitle", cleanExperienceTitle(clean));
                }
                if (dates != null) putDateRange(entry, dates);
            } else if (dateOnly && !entry.isEmpty()) {
                putDateRange(entry, dates);
            } else if (!entry.containsKey("company") && !looksLikeExperienceCompanyLine(clean, line)) {
                description.add(clean);
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
        return items.stream().limit(20).toList();
    }

    private List<String> expandEmbeddedExperienceLines(List<String> lines) {
        List<String> expanded = new ArrayList<>();
        java.util.regex.Pattern embeddedTitle = java.util.regex.Pattern.compile(
                "(?i)^(.+?[.!?])\\s+((?:senior|junior|lead|principal|associate|assistant)?\\s*(?:ui/ux|ui|ux|product|graphic|web|software|full stack|frontend|backend|data|business|marketing|sales|hr|project|customer|fashion|video|fitness)?\\s*(?:" + EXPERIENCE_ROLE_WORDS + ")\\b.*)$"
        );
        for (String line : lines) {
            String clean = stripBullet(line);
            java.util.regex.Matcher matcher = embeddedTitle.matcher(clean);
            if (matcher.matches()) {
                expanded.add(matcher.group(1).trim());
                expanded.add(matcher.group(2).trim());
            } else {
                expanded.add(line);
            }
        }
        return expanded;
    }

    private List<Map<String, String>> repairExperienceDateTitleRows(List<Map<String, String>> items) {
        if (items == null || items.isEmpty()) return List.of();
        List<Map<String, String>> repaired = new ArrayList<>();
        for (Map<String, String> item : items) {
            Map<String, String> entry = new LinkedHashMap<>(item);
            String title = safeTrim(entry.get("jobTitle"));
            String dates = extractYearRange(title);
            if (dates != null) {
                String cleanTitle = cleanExperienceTitle(title);
                if (!cleanTitle.isBlank() && looksLikeExperienceTitle(cleanTitle)) {
                    entry.put("jobTitle", cleanTitle);
                    putDateRange(entry, dates);
                }
            }
            repaired.add(entry);
        }
        return repaired;
    }

    private boolean looksLikeExperienceTitle(String line) {
        String lower = line == null ? "" : line.toLowerCase(Locale.ROOT);
        return line.length() <= 100
                && !looksLikeSentence(line)
                && lower.matches(".*\\b(" + EXPERIENCE_ROLE_WORDS + ")\\b.*");
    }

    private Map<String, String> parseCompactExperienceHeader(String line) {
        Map<String, String> result = new LinkedHashMap<>();
        String dates = extractYearRange(line);
        String withoutDates = dates == null ? line : line.replace(dates, "").replaceAll("\\(\\s*\\)", "").trim();
        String[] parts = withoutDates.split("\\s*(?:[-|,]|\\bat\\b)\\s*", 2);
        if (parts.length == 2 && looksLikeExperienceTitle(parts[0]) && parts[1].length() <= 90) {
            result.put("jobTitle", cleanExperienceTitle(parts[0]));
            result.put("company", parts[1].trim());
            return result;
        }

        java.util.regex.Matcher matcher = java.util.regex.Pattern.compile(
                "(?i)^(.+?\\b(?:" + EXPERIENCE_ROLE_WORDS + ")\\b)\\s+(.{2,90})$"
        ).matcher(withoutDates);
        if (matcher.matches()) {
            String title = matcher.group(1).trim();
            String company = matcher.group(2).trim();
            if (looksLikeExperienceTitle(title) && looksLikeCompanyName(company)) {
                result.put("jobTitle", cleanExperienceTitle(title));
                result.put("company", company);
            }
        }
        return result;
    }

    private boolean looksLikeCompanyName(String value) {
        String text = value == null ? "" : value.trim();
        String lower = text.toLowerCase(Locale.ROOT);
        return text.length() >= 2
                && text.length() <= 90
                && !looksLikeSentence(text)
                && (lower.matches(".*\\b(studio|pvt|private|ltd|limited|inc|llc|corp|company|solutions|technologies|systems|agency|labs)\\b.*")
                    || text.matches(".*[A-Z][a-z]+\\s+[A-Z][A-Za-z]+.*"));
    }

    private boolean looksLikeExperienceCompanyLine(String clean, String originalLine) {
        String text = clean == null ? "" : clean.trim();
        String original = originalLine == null ? "" : originalLine.trim();
        String lower = text.toLowerCase(Locale.ROOT);
        return text.length() >= 2
                && text.length() <= 90
                && !original.startsWith("-")
                && !original.startsWith("â€¢")
                && !looksLikeSentence(text)
                && !looksLikeExperienceTitle(text)
                && !looksLikeProjectDescriptionLine(text)
                && !lower.matches(".*\\b(developed|designed|created|built|implemented|managed|worked|responsible|collaborated|handled|used|using|tools|technologies|tech stack|description)\\b.*");
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

    private List<Map<String, String>> parseProjectsImprovedV2(List<String> projectLines) {
        if (projectLines == null || projectLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> current = new LinkedHashMap<>();
        for (String line : projectLines) {
            if (line == null || line.trim().length() < 3) continue;

            String mappedHeading = mapSectionHeading(line);
            if (mappedHeading != null && !"projects".equals(mappedHeading)) break;
            if ("projects".equals(mappedHeading)) continue;

            String clean = stripBullet(line);
            if (clean.isBlank()) continue;

            if (current.isEmpty()) {
                current.put("title", clean.length() > 90 ? clean.substring(0, 90) : clean);
                continue;
            }

            if (looksLikeProjectTitleLine(clean, line, current)) {
                items.add(current);
                current = new LinkedHashMap<>();
                current.put("title", clean.length() > 90 ? clean.substring(0, 90) : clean);
            } else {
                current.merge("description", clean, (oldVal, newVal) -> oldVal + "\n" + newVal);
            }
        }
        if (!current.isEmpty()) items.add(current);
        return items.stream()
                .filter(item -> item.values().stream().anyMatch(value -> value != null && !value.isBlank()))
                .limit(20)
                .toList();
    }

    private List<Map<String, String>> parseProjectsImproved(List<String> projectLines) {
        if (projectLines == null || projectLines.isEmpty()) return List.of();

        List<Map<String, String>> items = new ArrayList<>();
        Map<String, String> current = new LinkedHashMap<>();
        for (String line : projectLines) {
            if (line.length() < 3) continue;
            String mappedHeading = mapSectionHeading(line);
            if (mappedHeading != null && !"projects".equals(mappedHeading)) break;
            if ("projects".equals(mappedHeading)) continue;
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
            if (!current.isEmpty() && !looksLikeProjectTitleLine(clean, line, current)) {
                current.merge("description", clean, (oldVal, newVal) -> oldVal + "\n" + newVal);
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
        return items.stream().limit(20).toList();
    }

    private boolean looksLikeProjectTitleLine(String clean, String originalLine, Map<String, String> current) {
        if (current == null || current.isEmpty()) return true;
        String text = clean == null ? "" : clean.trim();
        String original = originalLine == null ? "" : originalLine.trim();
        String lower = text.toLowerCase(Locale.ROOT);
        if (text.isBlank() || text.length() > 90 || original.startsWith("-") || original.startsWith("â€¢")) return false;
        if (looksLikeProjectDescriptionLine(text)) return false;
        if (lower.matches("^(tools|technologies|tech stack|environment|role|team size|duration)\\s*[:\\-].*")) return false;
        if (lower.matches(".*\\b(system|portal|platform|application|app|website|dashboard|management|tracker|clone|redesign|project)\\b.*")) return true;
        return !current.containsKey("description") && !looksLikeSentence(text);
    }

    private boolean looksLikeProjectDescriptionLine(String line) {
        String lower = line == null ? "" : stripBullet(line).toLowerCase(Locale.ROOT);
        return lower.matches(".*\\b(developed|designed|created|built|implemented|managed|integrated|improved|used|using|allows|helps|responsible|collaborated|features?|modules?|database|frontend|backend|api|apis|details|exported|ats-friendly|patient|registration|appointment|booking|billing|pharmacy|laboratory|doctor|catalog|shopping|cart|payment|inventory|admin)\\b.*")
                || looksLikeSentence(line);
    }

    private List<String> splitProjectTitles(String line) {
        String value = stripBullet(line);
        if (value.isBlank()) return List.of();
        if (!looksLikeStandaloneProjectTitle(value)) return List.of(value);
        List<String> simple = Arrays.stream(value.split("\\s*(?:[,;|\\u2022\\u00B7â€¢Â·]|\\s+[-–—]+\\s+)\\s*"))
                .map(String::trim)
                .filter(part -> part.length() >= 3)
                .toList();
        if (simple.size() > 1) {
            return simple.stream()
                    .flatMap(part -> splitProjectTitleRun(part).stream())
                    .filter(part -> part.length() >= 3)
                    .toList();
        }

        List<String> titles = splitProjectTitleRun(value);
        return titles.size() > 1 ? titles : List.of(value);
    }

    private boolean looksLikeStandaloneProjectTitle(String value) {
        String text = value == null ? "" : stripBullet(value).trim();
        String lower = text.toLowerCase(Locale.ROOT);
        if (text.isBlank() || text.length() > 120) return false;
        if (looksLikeProjectDescriptionLine(text)) return false;
        if (lower.matches("^(technologies|tools|tech stack|environment|role|duration)\\s*[:\\-].*")) return false;
        return lower.matches(".*\\b(resume parser|e-commerce|ecommerce|system|portal|platform|application|app|website|dashboard|management|tracker|clone|redesign|project)\\b.*");
    }

    private List<String> splitProjectTitleRun(String value) {
        List<String> titles = new ArrayList<>();
        java.util.regex.Matcher matcher = java.util.regex.Pattern
                .compile(".+?(?:Management System|Learning Portal|Enterprise Portal|E-Commerce Platform|Portal|Platform|System|Website UI|Website|Application|App Redesign|Appointment App|App|Dashboard)(?=\\s+[A-Z]|$)")
                .matcher(value);
        while (matcher.find()) {
            String title = matcher.group().trim();
            if (title.length() >= 3) titles.add(title);
        }
        return titles.isEmpty() ? List.of(value) : titles;
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
                    .filter(value -> !value.isBlank() && isValidAdditionalSectionLine(key, value))
                    .limit(40)
                    .toList();
            if (!cleaned.isEmpty()) additional.put(key, cleaned);
        }
        if (!additional.containsKey("certifications")) {
            List<String> fallbackCerts = sections.values().stream()
                    .flatMap(List::stream)
                    .map(this::stripBullet)
                    .filter(value -> value.length() >= 5 && value.length() <= 100)
                    .filter(value -> value.toLowerCase(Locale.ROOT).matches(".*\\b(certified|certification|certificate|oracle|aws)\\b.*"))
                    .filter(value -> !isSectionHeading(value) && !looksLikeContactLine(value) && isValidCertificationLine(value))
                    .distinct()
                    .limit(10)
                    .toList();
            if (!fallbackCerts.isEmpty()) {
                additional.put("certifications", fallbackCerts);
            }
        }
        return additional;
    }

    private boolean isValidAdditionalSectionLine(String sectionKey, String value) {
        String key = sectionKey == null ? "" : sectionKey.toLowerCase(Locale.ROOT);
        if (looksLikeContactLine(value) || looksLikeBadNameLine(value)) return false;
        if ("languages".equals(key) || "language".equals(key)) return looksLikeLanguageLine(value);
        if ("certifications".equals(key) || "certification".equals(key)) return isValidCertificationLine(value);
        return true;
    }

    private boolean isValidCertificationLine(String value) {
        String text = value == null ? "" : stripBullet(value).trim();
        String lower = text.toLowerCase(Locale.ROOT);
        if (text.isBlank() || looksLikeSummaryLine(text)) return false;
        if (lower.matches("^(tools?|technologies|tech stack|languages?|frameworks?|databases?|database)\\s*[:\\-].*")) return false;
        if (lower.matches(".*\\b(react|mysql|docker|postman|jenkins|maven|kubernetes|hibernate|spring boot|javascript|html|css|apis?)\\b.*")
                && !lower.matches(".*\\b(certified|certification|certificate|professional|associate)\\b.*")) return false;
        return true;
    }

    private boolean looksLikeLanguageLine(String value) {
        String text = value == null ? "" : stripBullet(value).trim();
        if (text.isBlank() || text.length() > 120) return false;
        if (text.matches(".*\\d.*") || text.contains("@") || text.toLowerCase(Locale.ROOT).contains("linkedin")) return false;
        if (looksLikeSentence(text) || looksLikeJobTitleLine(text) || looksLikeAddressLine(text)) return false;
        String[] parts = text.split("[,;/|]+");
        for (String part : parts) {
            String language = part.trim();
            if (language.isBlank()) continue;
            if (!language.matches("(?i)[a-z][a-z .'-]*(?:\\s*\\((?:native|fluent|professional|basic|intermediate|advanced)\\))?")) {
                return false;
            }
        }
        return true;
    }

    private boolean looksLikeSummaryLine(String value) {
        String lower = value == null ? "" : stripBullet(value).toLowerCase(Locale.ROOT);
        return lower.matches(".*\\b(results-driven|driven|professional|experience|building|applications|using|skilled|passionate|seeking|years?)\\b.*");
    }

    private boolean looksLikeContactLine(String line) {
        String value = line == null ? "" : line.trim();
        String lower = value.toLowerCase(Locale.ROOT);
        return value.contains("@")
                || lower.contains("linkedin.com")
                || lower.matches("^\\s*(phone|mobile|email|address|contact)\\s*[:\\-].*")
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
        String value = line == null ? "" : line;
        String monthYearRange = firstMatch(value, "\\b(?:0?[1-9]|1[0-2])\\s*/\\s*(?:19|20)\\d{2}\\s*(?:[-–—]|\\bto\\b)\\s*(?:(?:0?[1-9]|1[0-2])\\s*/\\s*(?:19|20)\\d{2}|Present|Current)\\b");
        if (monthYearRange != null) return monthYearRange;
        return firstMatch(line, "(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}\\s*(?:(?:[-–—]|\\bto\\b)\\s*(?:(?:Present|Current|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\\s+)?(?:19|20)\\d{2}|Present|Current))?");
    }
}
