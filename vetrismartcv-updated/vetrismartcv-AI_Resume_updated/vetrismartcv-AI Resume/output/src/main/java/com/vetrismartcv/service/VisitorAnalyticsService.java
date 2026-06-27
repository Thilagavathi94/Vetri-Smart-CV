package com.vetrismartcv.service;

import com.vetrismartcv.model.User;
import com.vetrismartcv.model.VisitorSession;
import com.vetrismartcv.repository.UserRepository;
import com.vetrismartcv.repository.VisitorSessionRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.WeekFields;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class VisitorAnalyticsService {

    private final VisitorSessionRepository visitorSessionRepository;
    private final UserRepository userRepository;

    public VisitorAnalyticsService(VisitorSessionRepository visitorSessionRepository, UserRepository userRepository) {
        this.visitorSessionRepository = visitorSessionRepository;
        this.userRepository = userRepository;
    }

    public void recordLogin(Long userId, HttpSession httpSession, HttpServletRequest request) {
        if (userId == null || httpSession == null) return;
        Optional<User> user = userRepository.findById(userId);
        if (user.isEmpty()) return;

        String sessionId = httpSession.getId();
        visitorSessionRepository.findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(sessionId)
                .ifPresent(existing -> {
                    existing.setLogoutTime(LocalDateTime.now());
                    visitorSessionRepository.save(existing);
                });

        VisitorSession visitorSession = VisitorSession.builder()
                .user(user.get())
                .sessionId(sessionId)
                .ipAddress(resolveIpAddress(request))
                .city(resolveHeader(request, "CF-IPCity", "X-AppEngine-City", "X-Visitor-City").orElse("Unknown"))
                .country(resolveHeader(request, "CF-IPCountry", "X-AppEngine-Country", "X-Visitor-Country").orElse("Unknown"))
                .locationLabel("Unknown")
                .deviceType(resolveDeviceType(userAgent(request)))
                .operatingSystem(resolveOperatingSystem(userAgent(request)))
                .browserName(resolveBrowser(userAgent(request)))
                .loginTime(LocalDateTime.now())
                .lastActiveAt(LocalDateTime.now())
                .build();
        visitorSessionRepository.save(visitorSession);
    }

    public void recordActivity(Long userId, HttpSession httpSession, HttpServletRequest request) {
        if (httpSession == null) return;
        visitorSessionRepository.findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(httpSession.getId())
                .ifPresent(session -> {
                    session.setLastActiveAt(LocalDateTime.now());
                    if ("Unknown".equals(valueOrUnknown(session.getDeviceType()))) {
                        session.setDeviceType(resolveDeviceType(userAgent(request)));
                    }
                    if ("Unknown".equals(valueOrUnknown(session.getOperatingSystem()))) {
                        session.setOperatingSystem(resolveOperatingSystem(userAgent(request)));
                    }
                    if ("Unknown".equals(valueOrUnknown(session.getBrowserName()))) {
                        session.setBrowserName(resolveBrowser(userAgent(request)));
                    }
                    visitorSessionRepository.save(session);
                });
        if (visitorSessionRepository.findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(httpSession.getId()).isEmpty()) {
            recordLogin(userId, httpSession, request);
        }
    }

    public void recordActivity(HttpSession httpSession) {
        recordActivity(null, httpSession, null);
    }

    public void updateCurrentLocation(HttpSession httpSession, Double latitude, Double longitude, String label) {
        if (httpSession == null || latitude == null || longitude == null) return;
        visitorSessionRepository.findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(httpSession.getId())
                .ifPresent(session -> {
                    String cleanLabel = valueOrUnknown(label);
                    session.setLatitude(latitude);
                    session.setLongitude(longitude);
                    session.setLocationLabel(cleanLabel);
                    session.setGoogleMapsUrl("https://www.google.com/maps?q=" + latitude + "," + longitude);
                    if (!"Unknown".equals(cleanLabel)) {
                        String[] parts = cleanLabel.split(",", 2);
                        session.setCity(parts[0].trim());
                        if (parts.length > 1) {
                            session.setCountry(parts[1].trim());
                        }
                    }
                    session.setLastActiveAt(LocalDateTime.now());
                    visitorSessionRepository.save(session);
                });
    }

    public void recordLogout(HttpSession httpSession) {
        if (httpSession == null) return;
        visitorSessionRepository.findTopBySessionIdAndLogoutTimeIsNullOrderByLoginTimeDesc(httpSession.getId())
                .ifPresent(session -> {
                    LocalDateTime now = LocalDateTime.now();
                    session.setLastActiveAt(now);
                    session.setLogoutTime(now);
                    visitorSessionRepository.save(session);
                });
    }

    @Transactional(readOnly = true)
    public Map<String, Object> analytics(LocalDate fromDate, LocalDate toDate) {
        LocalDate today = LocalDate.now();
        LocalDateTime todayStart = today.atStartOfDay();
        LocalDateTime tomorrowStart = today.plusDays(1).atStartOfDay();
        LocalDateTime activeCutoff = LocalDateTime.now().minusMinutes(5);

        List<VisitorSession> todaySessions = visitorSessionRepository.findByLoginTimeBetween(todayStart, tomorrowStart);
        DateRange range = resolveRange(fromDate, toDate);
        List<VisitorSession> filteredSessions = visitorSessionRepository.findByLoginTimeBetween(range.from().atStartOfDay(), range.to().plusDays(1).atStartOfDay());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", Map.of(
                "todaysVisitors", uniqueUsers(todaySessions),
                "newAccountsToday", userRepository.countByCreatedAtBetween(todayStart, tomorrowStart),
                "totalSessionsToday", todaySessions.size(),
                "totalUsageHoursToday", roundHours(totalDurationMinutes(todaySessions) / 60.0),
                "activeUsers", todaySessions.stream()
                        .filter(s -> s.getLogoutTime() == null && safeLastActive(s).isAfter(activeCutoff))
                        .map(s -> s.getUser() == null ? null : s.getUser().getId())
                        .filter(Objects::nonNull)
                        .collect(Collectors.toSet())
                        .size()
        ));
        response.put("activities", activityRows(filteredSessions, range));
        response.put("reports", reportRows(filteredSessions));
        response.put("filter", Map.of("fromDate", range.from(), "toDate", range.to()));
        return response;
    }

    private DateRange resolveRange(LocalDate fromDate, LocalDate toDate) {
        if (fromDate == null && toDate == null) {
            LocalDate today = LocalDate.now();
            return new DateRange(today, today);
        }
        LocalDate from = fromDate != null ? fromDate : toDate;
        LocalDate to = toDate != null ? toDate : fromDate;
        if (from.isAfter(to)) {
            LocalDate swap = from;
            from = to;
            to = swap;
        }
        return new DateRange(from, to);
    }

    private List<Map<String, Object>> activityRows(List<VisitorSession> sessions, DateRange range) {
        Map<String, Long> visitsByUserInRange = visitorSessionRepository.findByLoginTimeBetween(
                        range.from().atStartOfDay(),
                        range.to().plusDays(1).atStartOfDay()
                ).stream()
                .filter(s -> s.getUser() != null)
                .collect(Collectors.groupingBy(s -> String.valueOf(s.getUser().getId()), Collectors.counting()));

        return sessions.stream()
                .sorted(Comparator.comparing(VisitorSession::getLoginTime, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(session -> {
                    User user = session.getUser();
                    long minutes = durationMinutes(session);
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("userName", user != null ? user.getName() : "Unknown User");
                    row.put("email", user != null ? user.getEmail() : "");
                    row.put("dateOfAccess", safeLogin(session).toLocalDate());
                    row.put("visitsInPeriod", user == null ? 0 : visitsByUserInRange.getOrDefault(String.valueOf(user.getId()), 0L));
                    row.put("loginTime", session.getLoginTime());
                    row.put("logoutTime", session.getLogoutTime() != null ? session.getLogoutTime() : safeLastActive(session));
                    row.put("totalSessionDuration", formatDuration(minutes));
                    row.put("totalHoursUsed", roundHours(minutes / 60.0));
                    row.put("lastActiveTimestamp", session.getLastActiveAt());
                    row.put("city", valueOrUnknown(session.getCity()));
                    row.put("country", valueOrUnknown(session.getCountry()));
                    row.put("location", locationKey(session));
                    row.put("googleMapsUrl", session.getGoogleMapsUrl());
                    row.put("deviceType", valueOrUnknown(session.getDeviceType()));
                    row.put("operatingSystem", valueOrUnknown(session.getOperatingSystem()));
                    row.put("browserName", valueOrUnknown(session.getBrowserName()));
                    return row;
                })
                .toList();
    }

    private List<Map<String, Object>> groupedRows(List<VisitorSession> sessions, Function<VisitorSession, String> classifier, String label) {
        return sessions.stream()
                .collect(Collectors.groupingBy(classifier, LinkedHashMap::new, Collectors.counting()))
                .entrySet()
                .stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> Map.<String, Object>of(label, entry.getKey(), "visitors", entry.getValue()))
                .toList();
    }

    private Map<String, Object> reportRows(List<VisitorSession> sessions) {
        Map<String, Object> reports = new LinkedHashMap<>();
        reports.put("dailyVisitorReport", groupedByDate(sessions, s -> safeLogin(s).toLocalDate().toString()));
        reports.put("weeklyVisitorReport", groupedByDate(sessions, s -> {
            LocalDate date = safeLogin(s).toLocalDate();
            int week = date.get(WeekFields.ISO.weekOfWeekBasedYear());
            return date.getYear() + "-W" + String.format("%02d", week);
        }));
        reports.put("monthlyVisitorReport", groupedByDate(sessions, s -> {
            LocalDate date = safeLogin(s).toLocalDate();
            return date.getYear() + "-" + String.format("%02d", date.getMonthValue());
        }));
        reports.put("mostActiveUsers", groupedUserReport(sessions, "visits"));
        reports.put("usersWithMaximumUsageHours", groupedUserUsageReport(sessions));
        reports.put("locationWiseVisitorStatistics", groupedRows(sessions, this::locationKey, "location"));
        return reports;
    }

    private List<Map<String, Object>> groupedByDate(List<VisitorSession> sessions, Function<VisitorSession, String> classifier) {
        return sessions.stream()
                .collect(Collectors.groupingBy(classifier, TreeMap::new, Collectors.counting()))
                .entrySet()
                .stream()
                .map(entry -> Map.<String, Object>of("period", entry.getKey(), "visitors", entry.getValue()))
                .toList();
    }

    private List<Map<String, Object>> groupedUserReport(List<VisitorSession> sessions, String metricName) {
        return sessions.stream()
                .filter(s -> s.getUser() != null)
                .collect(Collectors.groupingBy(s -> s.getUser().getName() + " (" + s.getUser().getEmail() + ")", Collectors.counting()))
                .entrySet()
                .stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .map(entry -> Map.<String, Object>of("user", entry.getKey(), metricName, entry.getValue()))
                .toList();
    }

    private List<Map<String, Object>> groupedUserUsageReport(List<VisitorSession> sessions) {
        return sessions.stream()
                .filter(s -> s.getUser() != null)
                .collect(Collectors.groupingBy(
                        s -> s.getUser().getName() + " (" + s.getUser().getEmail() + ")",
                        Collectors.summingLong(this::durationMinutes)
                ))
                .entrySet()
                .stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .map(entry -> Map.<String, Object>of("user", entry.getKey(), "hours", roundHours(entry.getValue() / 60.0)))
                .toList();
    }

    private long uniqueUsers(List<VisitorSession> sessions) {
        return sessions.stream()
                .map(VisitorSession::getUser)
                .filter(Objects::nonNull)
                .map(User::getId)
                .distinct()
                .count();
    }

    private long totalDurationMinutes(List<VisitorSession> sessions) {
        return sessions.stream().mapToLong(this::durationMinutes).sum();
    }

    private long durationMinutes(VisitorSession session) {
        LocalDateTime from = safeLogin(session);
        LocalDateTime to = session.getLogoutTime() != null ? session.getLogoutTime() : safeLastActive(session);
        return Math.max(0, Duration.between(from, to).toMinutes());
    }

    private LocalDateTime safeLogin(VisitorSession session) {
        return session.getLoginTime() != null ? session.getLoginTime() : LocalDateTime.now();
    }

    private LocalDateTime safeLastActive(VisitorSession session) {
        return session.getLastActiveAt() != null ? session.getLastActiveAt() : safeLogin(session);
    }

    private String formatDuration(long minutes) {
        long hours = minutes / 60;
        long remainingMinutes = minutes % 60;
        return hours + "h " + remainingMinutes + "m";
    }

    private double roundHours(double hours) {
        return Math.round(hours * 100.0) / 100.0;
    }

    private String locationKey(VisitorSession session) {
        if (!"Unknown".equals(valueOrUnknown(session.getLocationLabel()))) {
            return session.getLocationLabel();
        }
        return valueOrUnknown(session.getCity()) + ", " + valueOrUnknown(session.getCountry());
    }

    private String deviceKey(VisitorSession session) {
        return valueOrUnknown(session.getDeviceType()) + " / "
                + valueOrUnknown(session.getOperatingSystem()) + " / "
                + valueOrUnknown(session.getBrowserName());
    }

    private String resolveIpAddress(HttpServletRequest request) {
        return resolveHeader(request, "CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP")
                .map(value -> value.split(",")[0].trim())
                .orElse(request != null ? request.getRemoteAddr() : "Unknown");
    }

    private Optional<String> resolveHeader(HttpServletRequest request, String... names) {
        if (request == null) return Optional.empty();
        for (String name : names) {
            String value = request.getHeader(name);
            if (value != null && !value.isBlank()) {
                return Optional.of(value.trim());
            }
        }
        return Optional.empty();
    }

    private String userAgent(HttpServletRequest request) {
        return request == null ? "" : Optional.ofNullable(request.getHeader("User-Agent")).orElse("");
    }

    private String resolveDeviceType(String userAgent) {
        String ua = userAgent.toLowerCase(Locale.ROOT);
        return ua.contains("mobile") || ua.contains("android") || ua.contains("iphone") ? "Mobile" : "Desktop";
    }

    private String resolveOperatingSystem(String userAgent) {
        String ua = userAgent.toLowerCase(Locale.ROOT);
        if (ua.contains("windows")) return "Windows";
        if (ua.contains("mac os") || ua.contains("macintosh")) return "macOS";
        if (ua.contains("android")) return "Android";
        if (ua.contains("iphone") || ua.contains("ipad")) return "iOS";
        if (ua.contains("linux")) return "Linux";
        return "Unknown";
    }

    private String resolveBrowser(String userAgent) {
        String ua = userAgent.toLowerCase(Locale.ROOT);
        if (ua.contains("edg/")) return "Microsoft Edge";
        if (ua.contains("chrome/") && !ua.contains("chromium")) return "Chrome";
        if (ua.contains("firefox/")) return "Firefox";
        if (ua.contains("safari/") && !ua.contains("chrome/")) return "Safari";
        if (ua.contains("opr/") || ua.contains("opera")) return "Opera";
        return "Unknown";
    }

    private String valueOrUnknown(String value) {
        return value == null || value.isBlank() ? "Unknown" : value;
    }

    private record DateRange(LocalDate from, LocalDate to) {
    }
}
