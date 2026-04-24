package com.vetrismartcv.controller;

import com.vetrismartcv.service.UserService;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

@Controller
public class PageController {

    @Autowired
    private UserService userService;

    @Value("${oauth.google.client-id:}")
    private String googleClientId;

    @Value("${oauth.linkedin.client-id:}")
    private String linkedinClientId;

    private void addLoginConfig(Model model) {
        model.addAttribute("googleClientId", googleClientId);
        model.addAttribute("linkedinClientId", linkedinClientId);
    }

    /**
     * Inject session user info into every page model.
     * Always re-reads the plan fresh from the DB so that upgrades
     * are reflected immediately without requiring a new login.
     */
    private void addSessionToModel(Model model, HttpSession session) {
        Long userId  = (Long)   session.getAttribute("userId");
        String name  = (String) session.getAttribute("userName");
        boolean loggedIn = (userId != null);

        String plan = "FREE";
        if (loggedIn) {
            // Always fetch fresh plan from DB — avoids stale session after upgrade
            plan = userService.getById(userId)
                       .map(u -> u.getPlan() != null ? u.getPlan().toUpperCase() : "FREE")
                       .orElse("FREE");
            // Keep session in sync
            session.setAttribute("userPlan", plan);
        }

        model.addAttribute("loggedIn",    loggedIn);
        model.addAttribute("userName",    loggedIn ? name : "");
        model.addAttribute("userPlan",    plan);
        model.addAttribute("userInitial", (loggedIn && name != null && !name.isEmpty())
                           ? String.valueOf(name.charAt(0)).toUpperCase() : "?");
    }

    @GetMapping("/")
    public String home(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "index";
    }

    @GetMapping("/builder")
    public String builder(Model model, HttpSession session) {
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

    @GetMapping("/dashboard")
    public String dashboard(Model model, HttpSession session) {
        addSessionToModel(model, session);
        return "dashboard";
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
}
