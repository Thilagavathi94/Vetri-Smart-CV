package com.vetrismartcv.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;

import java.util.Properties;

@Configuration
public class MailConfig {

    @Bean
    public JavaMailSender javaMailSender(
            @Value("${spring.mail.host:smtp.gmail.com}") String host,
            @Value("${spring.mail.port:587}") int port,
            @Value("${spring.mail.username:}") String username,
            @Value("${spring.mail.password:}") String password,
            @Value("${spring.mail.properties.mail.smtp.auth:true}") String smtpAuth,
            @Value("${spring.mail.properties.mail.smtp.starttls.enable:true}") String startTls,
            @Value("${spring.mail.properties.mail.smtp.starttls.required:true}") String startTlsRequired,
            @Value("${spring.mail.properties.mail.smtp.ssl.enable:false}") String sslEnable,
            @Value("${spring.mail.properties.mail.smtp.ssl.trust:smtp.gmail.com}") String sslTrust,
            @Value("${spring.mail.properties.mail.smtp.connectiontimeout:10000}") String connectionTimeout,
            @Value("${spring.mail.properties.mail.smtp.timeout:10000}") String timeout,
            @Value("${spring.mail.properties.mail.smtp.writetimeout:10000}") String writeTimeout) {

        boolean useSsl = "465".equals(String.valueOf(port)) || Boolean.parseBoolean(sslEnable);
        JavaMailSenderImpl sender = new JavaMailSenderImpl();
        sender.setHost(host == null || host.isBlank() ? "smtp.gmail.com" : host.trim());
        sender.setPort(port);
        sender.setUsername(username == null ? "" : username.trim());
        sender.setPassword(normalizeAppPassword(password));

        Properties props = sender.getJavaMailProperties();
        props.put("mail.transport.protocol", "smtp");
        props.put("mail.smtp.auth", smtpAuth);
        props.put("mail.smtp.starttls.enable", useSsl ? "false" : startTls);
        props.put("mail.smtp.starttls.required", useSsl ? "false" : startTlsRequired);
        props.put("mail.smtp.ssl.enable", String.valueOf(useSsl));
        props.put("mail.smtp.ssl.trust", sslTrust);
        props.put("mail.smtp.connectiontimeout", connectionTimeout);
        props.put("mail.smtp.timeout", timeout);
        props.put("mail.smtp.writetimeout", writeTimeout);
        return sender;
    }

    private String normalizeAppPassword(String password) {
        return password == null ? "" : password.replaceAll("\\s+", "");
    }
}
