package com.vetrismartcv.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * REST API for resume template management.
 * Provides template listing, metadata, and selection tracking.
 */
@RestController
@RequestMapping("/api/templates")
@CrossOrigin(origins = "*")
public class TemplateController {

    /**
     * All 5 built-in resume templates with metadata.
     * Extend this list to add new templates dynamically.
     */
    private static final List<Map<String, Object>> TEMPLATES = List.of(
        buildTemplate("template1", "Vivid Pro",
            "Bold dark header with circular avatar, two-column layout. Perfect for creative and design roles.",
            "free", List.of("creative", "modern", "dark"), "★★★★★", 4200, true),
        buildTemplate("template2", "Nordic Split",
            "Clean gray sidebar with circular photo. Ideal for UX/UI designers and creative professionals.",
            "free", List.of("minimal", "modern", "clean"), "★★★★★", 3800, true),
        buildTemplate("template3", "Golden Edge",
            "Warm gold accents with a left photo panel. Great for UX/UI and design intern roles.",
            "free", List.of("minimal", "creative", "modern"), "★★★★☆", 2900, true),
        buildTemplate("template4", "Amber Bold",
            "Yellow accent bars with skill progress charts. Highly visual and impactful for portfolios.",
            "pro", List.of("modern", "creative", "skills"), "★★★★★", 5100, false),
        buildTemplate("template5", "Monochrome Bold",
            "Dramatic black header split with a photo. Bold, memorable, great for senior professionals.",
            "pro", List.of("modern", "bold", "creative"), "★★★★★", 6300, false),
        buildTemplate("template6", "Purple Dark",
            "Dark purple sidebar with skill bars and geometric accents. Ideal for marketing and business roles.",
            "free", List.of("modern", "dark", "creative"), "★★★★★", 3500, true),
        buildTemplate("template7", "Dark Teal",
            "Deep teal/dark header with dot-skill indicators and qualities panel. Striking and professional.",
            "free", List.of("dark", "modern", "bold"), "★★★★★", 4100, true),
        buildTemplate("template8", "Orange Geo",
            "Bold orange geometric accents with dark sidebar and three-column layout. Eye-catching and modern.",
            "pro", List.of("creative", "modern", "bold"), "★★★★★", 5700, false),
        buildTemplate("template9", "Green Pro",
            "Rich forest green sidebar with banded section headers. Clean and professional for all industries.",
            "free", List.of("minimal", "modern", "green"), "★★★★☆", 3200, true),
        buildTemplate("template10", "Yellow Wave",
            "Golden wave header with dark footer skill bars and contact strip. Ultra-modern for product managers.",
            "pro", List.of("creative", "modern", "bold"), "★★★★★", 7200, false),

        // ── Image-based templates (t11–t20) ──
        buildTemplate("template11", "Vivid Creative",
            "Bold dark header with circular avatar and colorful blob accents. Perfect for creative and design roles.",
            "free", List.of("creative", "modern", "colorful"), "★★★★★", 4200, true),
        buildTemplate("template12", "Nordic Coral",
            "Coral pink banner with organic blob accents and photo panel. Ideal for graphic designers.",
            "free", List.of("minimal", "modern", "clean"), "★★★★★", 3800, true),
        buildTemplate("template13", "Purple Soft",
            "Clean white layout with purple skill progress bars and rounded photo frame. Great for software engineers.",
            "free", List.of("minimal", "modern", "skills"), "★★★★★", 2900, true),
        buildTemplate("template14", "Navy Timeline",
            "Dark navy right panel with gold timeline dots and teal skill bars. Commanding for engineers.",
            "free", List.of("modern", "dark", "bold"), "★★★★★", 5100, true),
        buildTemplate("template15", "Classic Mono",
            "Timeless black-and-white two-column layout with bordered headers. ATS-friendly and universally accepted.",
            "free", List.of("minimal", "clean", "classic"), "★★★★☆", 3100, true),
        buildTemplate("template16", "Dark Khaki",
            "Deep forest-green and khaki two-tone layout with circular B&W photo and skill bars.",
            "pro", List.of("dark", "modern", "bold"), "★★★★★", 4100, false),
        buildTemplate("template17", "Gradient Aura",
            "Soft blush-to-lavender gradient header with dot-based skill indicators. Stunning for UI/UX designers.",
            "free", List.of("modern", "creative", "minimal"), "★★★★★", 6300, true),
        buildTemplate("template18", "Sky Blue Pro",
            "Bold sky-blue header with circular avatar and clean two-column skill bars. Perfect for web designers.",
            "pro", List.of("modern", "bold", "clean"), "★★★★★", 5700, false),
        buildTemplate("template19", "Blush Manager",
            "Soft lavender-grey geometric split with circular photo and blush skill bars. Elegant for project managers.",
            "free", List.of("minimal", "modern", "creative"), "★★★★☆", 3200, true),
        buildTemplate("template20", "Azure Split",
            "Crisp azure accent stripe with clean two-column layout and circular photo. Go-to for senior product designers.",
            "pro", List.of("modern", "minimal", "clean"), "★★★★★", 7200, false),

        // ── Image-based templates (t21–t31) ──
        buildTemplate("template21", "Harvard Blue",
            "Classic navy-blue header with clean two-column ATS-friendly layout. Trusted by top university graduates.",
            "free", List.of("minimal", "clean", "classic"), "★★★★★", 5400, true),
        buildTemplate("template22", "Forest Green",
            "Bold forest-green section banners with circular photo and language bars. Ideal for UX/UI interaction designers.",
            "free", List.of("modern", "creative", "clean"), "★★★★★", 4600, true),
        buildTemplate("template23", "Orange Splash",
            "Vibrant orange section labels with circular photo and clean two-column layout. Eye-catching for designers.",
            "free", List.of("modern", "creative", "bold"), "★★★★☆", 3700, true),
        buildTemplate("template24", "Dark Olive",
            "Dramatic charcoal background with lime-green headings and rectangular photo. Perfect for UI designers.",
            "pro", List.of("dark", "modern", "bold"), "★★★★★", 6800, false),
        buildTemplate("template25", "Cyan Banner",
            "Vivid cyan header with dark info strip and dotted timeline layout. Great for graphics & web designers.",
            "free", List.of("modern", "bold", "clean"), "★★★★★", 4900, true),
        buildTemplate("template26", "Amber Dark",
            "Striking black & amber two-column layout with grayscale photo and amber skill bars. For art directors.",
            "pro", List.of("dark", "modern", "bold"), "★★★★★", 7500, false),
        buildTemplate("template27", "Blob Navy",
            "Soft canvas with navy organic blob accents and clean two-column skill list. Elegant for product designers.",
            "free", List.of("modern", "minimal", "creative"), "★★★★★", 5200, true),
        buildTemplate("template28", "Caroline Clean",
            "Ultra-clean white layout with small circular photo, salmon accents, and italic typography. For UX/UI designers.",
            "free", List.of("minimal", "clean", "modern"), "★★★★★", 4300, true),
        buildTemplate("template29", "Mint Minimal",
            "Airy mint-tinted header with clean two-column body and teal section titles. For senior product designers.",
            "free", List.of("minimal", "modern", "clean"), "★★★★★", 3900, true),
        buildTemplate("template30", "Slate Dev",
            "Slate-grey sidebar with company logos and dotted timeline. Built for frontend developers and engineers.",
            "free", List.of("modern", "minimal", "dark"), "★★★★★", 5800, true),
        buildTemplate("template31", "Indigo Marketing",
            "Sharp indigo accent bar with centered role badge and clean layout. ATS-optimized for marketing specialists.",
            "pro", List.of("modern", "clean", "minimal"), "★★★★★", 6100, false)
    );

    // ── GET /api/templates ── List all templates
    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> listAll(
            @RequestParam(required = false) String plan,
            @RequestParam(required = false) String tag) {
        List<Map<String, Object>> result = new ArrayList<>(TEMPLATES);
        if (plan != null && !plan.isBlank()) {
            result = result.stream()
                .filter(t -> plan.equalsIgnoreCase((String) t.get("plan")))
                .collect(java.util.stream.Collectors.toList());
        }
        if (tag != null && !tag.isBlank()) {
            result = result.stream()
                .filter(t -> {
                    @SuppressWarnings("unchecked")
                    List<String> tags = (List<String>) t.get("tags");
                    return tags != null && tags.contains(tag.toLowerCase());
                })
                .collect(java.util.stream.Collectors.toList());
        }
        return ResponseEntity.ok(result);
    }

    // ── GET /api/templates/{id} ── Get single template
    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getById(@PathVariable String id) {
        return TEMPLATES.stream()
            .filter(t -> id.equals(t.get("id")))
            .findFirst()
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    // ── GET /api/templates/free ── Get free templates only
    @GetMapping("/free")
    public ResponseEntity<List<Map<String, Object>>> getFree() {
        List<Map<String, Object>> free = TEMPLATES.stream()
            .filter(t -> "free".equals(t.get("plan")))
            .collect(java.util.stream.Collectors.toList());
        return ResponseEntity.ok(free);
    }

    // ── POST /api/templates/{id}/select ── Track template selection
    @PostMapping("/{id}/select")
    public ResponseEntity<Map<String, Object>> trackSelection(
            @PathVariable String id,
            @RequestBody(required = false) Map<String, Object> body) {
        boolean exists = TEMPLATES.stream().anyMatch(t -> id.equals(t.get("id")));
        if (!exists) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of(
            "success", true,
            "templateId", id,
            "message", "Template selected successfully",
            "redirectUrl", "/builder?template=" + id
        ));
    }

    // ── GET /api/templates/count ── Count by plan
    @GetMapping("/count")
    public ResponseEntity<Map<String, Object>> count() {
        long freeCount = TEMPLATES.stream().filter(t -> "free".equals(t.get("plan"))).count();
        long proCount  = TEMPLATES.stream().filter(t -> "pro".equals(t.get("plan"))).count();
        return ResponseEntity.ok(Map.of(
            "total", TEMPLATES.size(),
            "free", freeCount,
            "pro", proCount
        ));
    }

    // ── Builder helper ──
    private static Map<String, Object> buildTemplate(
            String id, String name, String description,
            String plan, List<String> tags, String stars, int uses, boolean atsOptimized) {
        Map<String, Object> t = new LinkedHashMap<>();
        t.put("id", id);
        t.put("name", name);
        t.put("description", description);
        t.put("plan", plan);
        t.put("tags", tags);
        t.put("stars", stars);
        t.put("uses", uses);
        t.put("atsOptimized", atsOptimized);
        t.put("previewUrl", "/api/templates/" + id + "/preview");
        return Collections.unmodifiableMap(t);
    }
}