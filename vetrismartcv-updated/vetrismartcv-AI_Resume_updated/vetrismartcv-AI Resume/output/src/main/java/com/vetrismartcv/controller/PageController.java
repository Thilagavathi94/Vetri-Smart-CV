package com.vetrismartcv.controller;

import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class PageController {

    @Autowired
    private UserService userService;

    @Value("${oauth.google.client-id:}")
    private String googleClientId;

    @Value("${oauth.google.redirect-uri:}")
    private String googleRedirectUri;

    @Value("${oauth.linkedin.client-id:}")
    private String linkedinClientId;

    @Value("${oauth.linkedin.redirect-uri:}")
    private String linkedinRedirectUri;

    private void addLoginConfig(Model model) {
        model.addAttribute("googleClientId", googleClientId);
        model.addAttribute("googleRedirectUri", googleRedirectUri);
        model.addAttribute("linkedinClientId", linkedinClientId);
        model.addAttribute("linkedinRedirectUri", linkedinRedirectUri);
    }

    /**
     * Inject session user info into every page model.
     * Re-reads the plan from the DB so upgrades are reflected quickly.
     * Falls back safely if the session is stale or the DB read fails.
     */
    private void addSessionToModel(Model model, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        String name = (String) session.getAttribute("userName");
        boolean loggedIn = (userId != null);

        String plan = "FREE";
        String role = "USER";
        if (loggedIn) {
            try {
                var user = userService.getById(userId).orElse(null);
                plan = user != null && user.getPlan() != null ? user.getPlan().toUpperCase() : "FREE";
                role = user != null && user.getRole() != null ? user.getRole().toUpperCase() : "USER";
                session.setAttribute("userPlan", plan);
                session.setAttribute("userRole", role);
            } catch (Exception ex) {
                session.removeAttribute("userId");
                session.removeAttribute("userName");
                session.removeAttribute("userPlan");
                session.removeAttribute("userRole");
                userId = null;
                name = null;
                loggedIn = false;
                plan = "FREE";
                role = "USER";
            }
        }

        model.addAttribute("loggedIn", loggedIn);
        model.addAttribute("userName", loggedIn ? name : "");
        model.addAttribute("userPlan", plan);
        model.addAttribute("userRole", role);
        model.addAttribute("isAdmin", "ADMIN".equalsIgnoreCase(role));
        model.addAttribute(
                "userInitial",
                (loggedIn && name != null && !name.isEmpty())
                        ? String.valueOf(name.charAt(0)).toUpperCase()
                        : "?"
        );
    }

    @GetMapping("/")
    public String home(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "index";
    }

    // D_022 FIX: Guard /builder — unauthenticated users must login first,
    // then be redirected back to the builder with their chosen template.
    @GetMapping("/builder")
    public String builder(Model model, HttpSession session,
                          @RequestParam(required = false) String template,
                          @RequestParam(required = false) Long resumeId) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            StringBuilder redirect = new StringBuilder("/builder");
            boolean hasParam = false;
            if (template != null && !template.isBlank()) {
                redirect.append("?template=").append(template);
                hasParam = true;
            }
            if (resumeId != null) {
                redirect.append(hasParam ? "&" : "?").append("resumeId=").append(resumeId);
            }
            return "redirect:/login?redirect=" +
                    java.net.URLEncoder.encode(redirect.toString(), java.nio.charset.StandardCharsets.UTF_8);
        }
        addSessionToModel(model, session);
        return "builder";
    }

    @GetMapping("/template")
    public String templates(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "templates";
    }

    @GetMapping("/pricing")
    public String pricing(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "pricing";
    }

    @GetMapping("/login")
    public String login(Model model) {
        addLoginConfig(model);
        return "login";
    }

    @GetMapping("/signup")
    public String signup(Model model) {
        addLoginConfig(model);
        return "login";
    }

    // D_022 FIX: Guard /dashboard — must be logged in
    @GetMapping("/dashboard")
    public String dashboard(Model model, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return "redirect:/login?redirect=/dashboard";
        }
        addSessionToModel(model, session);
        return "dashboard";
    }

    @GetMapping("/admin")
    public String admin(Model model, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return "redirect:/login?redirect=/admin";
        }
        if (!userService.isAdmin(userId)) {
            return "redirect:/dashboard?accessDenied=admin";
        }
        addSessionToModel(model, session);
        return "admin";
    }

    @GetMapping("/admin/visitor-analytics")
    public String visitorAnalytics(Model model, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return "redirect:/login?redirect=/admin/visitor-analytics";
        }
        if (!userService.isAdmin(userId)) {
            return "redirect:/dashboard?accessDenied=admin";
        }
        addSessionToModel(model, session);
        return "visitor-analytics";
    }

    @GetMapping("/review/{id}")
    public String review(@PathVariable Long id, Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "review";
    }

    @GetMapping("/review")
    public String reviewNew(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "review";
    }

    @GetMapping("/payment")
    public String payment(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "payment";
    }

    @GetMapping("/register")
    public String registerPage(Model model) {
        addLoginConfig(model);
        return "login";
    }

    @GetMapping("/forgot-password")
    public String forgotPassword(Model model) {
        return "forgot-password";
    }

    @GetMapping("/reset-password")
    public String resetPassword(@RequestParam(required = false) String token, Model model) {
        model.addAttribute("token", token == null ? "" : token);
        return "reset-password";
    }
}
