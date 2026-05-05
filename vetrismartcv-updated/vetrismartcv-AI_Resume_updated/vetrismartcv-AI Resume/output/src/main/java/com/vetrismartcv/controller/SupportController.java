package com.vetrismartcv.controller;

import com.vetrismartcv.model.SupportContactRequest;
import com.vetrismartcv.service.SupportService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {

    private final SupportService supportService;

    @GetMapping("/config")
    public Map<String, Object> getSupportConfig() {
        return supportService.getSupportConfig();
    }

    @PostMapping("/contact")
    public Map<String, Object> submitContact(@Valid @RequestBody SupportContactRequest request,
                                             BindingResult bindingResult) {
        if (bindingResult.hasErrors()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", bindingResult.getFieldError() != null
                    ? bindingResult.getFieldError().getDefaultMessage()
                    : "Please correct the highlighted fields and try again.");
            return response;
        }

        return supportService.submitContactRequest(request);
    }
}
