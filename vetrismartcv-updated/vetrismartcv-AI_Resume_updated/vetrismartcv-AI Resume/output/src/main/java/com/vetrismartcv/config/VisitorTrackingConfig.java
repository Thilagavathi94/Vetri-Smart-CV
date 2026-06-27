package com.vetrismartcv.config;

import com.vetrismartcv.service.VisitorAnalyticsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Component
public class VisitorTrackingConfig implements WebMvcConfigurer {

    private final VisitorAnalyticsService visitorAnalyticsService;

    public VisitorTrackingConfig(VisitorAnalyticsService visitorAnalyticsService) {
        this.visitorAnalyticsService = visitorAnalyticsService;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new VisitorTrackingInterceptor(visitorAnalyticsService))
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/css/**",
                        "/js/**",
                        "/images/**",
                        "/favicon.ico",
                        "/api/admin/visitor-analytics/location"
                );
    }

    private static class VisitorTrackingInterceptor implements HandlerInterceptor {
        private final VisitorAnalyticsService visitorAnalyticsService;

        private VisitorTrackingInterceptor(VisitorAnalyticsService visitorAnalyticsService) {
            this.visitorAnalyticsService = visitorAnalyticsService;
        }

        @Override
        public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
            HttpSession session = request.getSession(false);
            if (session == null) {
                return true;
            }
            Long userId = (Long) session.getAttribute("userId");
            if (userId != null) {
                visitorAnalyticsService.recordActivity(userId, session, request);
            }
            return true;
        }
    }
}
