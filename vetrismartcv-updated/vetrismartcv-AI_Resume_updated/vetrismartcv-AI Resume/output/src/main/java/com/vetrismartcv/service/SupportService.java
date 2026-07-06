package com.vetrismartcv.service;

import com.vetrismartcv.model.SupportContactRequest;
import jakarta.mail.internet.MimeMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Slf4j
public class SupportService {

    private final JavaMailSender mailSender;

    @Value("${support.phone-display:8438164827 / 8438781327}")
    private String supportPhoneDisplay;

    @Value("${support.phone-link:tel:+918438164827}")
    private String supportPhoneLink;

    @Value("${support.email:vetritechnologysolutions@gmail.com}")
    private String supportEmail;

    @Value("${support.address:April's Complex, Bus Stand Backside, Surandai - 627859 | Shanthi's Complex, Surandai Old Market, Near Bus Stand, Surandai - 627859}")
    private String supportAddress;

    @Value("${support.map-url:https://maps.google.com/?q=Surandai,Tamil+Nadu+627859}")
    private String supportMapUrl;

    @Value("${support.hours:Mon-Fri, 9am-6pm IST}")
    private String supportHours;

    @Value("${spring.mail.username:}")
    private String supportFromEmail;

    public SupportService(ObjectProvider<JavaMailSender> mailSenderProvider) {
        this.mailSender = mailSenderProvider.getIfAvailable();
    }

    public Map<String, Object> getSupportConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("phoneDisplay", supportPhoneDisplay);
        config.put("phoneLink", supportPhoneLink);
        config.put("email", supportEmail);
        config.put("address", supportAddress);
        config.put("mapUrl", supportMapUrl);
        config.put("hours", supportHours);
        config.put("emailEnabled", isMailConfigured());
        return config;
    }

    public Map<String, Object> submitContactRequest(SupportContactRequest request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        request.setEmail(normalizedEmail);

        log.info("Support contact request received from {} <{}> with subject '{}'",
                request.getName(), normalizedEmail, request.getSubject());

        boolean emailSent = sendAcknowledgementEmailIfConfigured(request);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("emailSent", emailSent);
        response.put("message", emailSent
                ? "Thank you for contacting VetriSmartCV. We have received your request and sent a confirmation email."
                : "Thank you for contacting VetriSmartCV. We have received your request and our support team will get back to you shortly.");
        return response;
    }

    private boolean sendAcknowledgementEmailIfConfigured(SupportContactRequest request) {
        if (!isMailConfigured()) {
            return false;
        }

        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, "UTF-8");
            helper.setTo(request.getEmail());
            helper.setFrom(supportFromEmail);
            helper.setSubject("Support Request Received");
            helper.setText(buildAcknowledgementBody(request), false);
            mailSender.send(mimeMessage);
            return true;
        } catch (Exception ex) {
            log.warn("Failed to send support acknowledgement email to {}", request.getEmail(), ex);
            return false;
        }
    }

    private boolean isMailConfigured() {
        return mailSender != null && supportFromEmail != null && !supportFromEmail.isBlank();
    }

    private String buildAcknowledgementBody(SupportContactRequest request) {
        return "Thank you for contacting VetriSmartCV.\n\n"
                + "We have received your support request and our team will get back to you shortly.\n\n"
                + "Request details:\n"
                + "Name: " + request.getName() + "\n"
                + "Subject: " + request.getSubject() + "\n\n"
                + "Regards,\n"
                + "VetriSmartCV Support\n"
                + supportPhoneDisplay + "\n"
                + supportEmail;
    }
}
