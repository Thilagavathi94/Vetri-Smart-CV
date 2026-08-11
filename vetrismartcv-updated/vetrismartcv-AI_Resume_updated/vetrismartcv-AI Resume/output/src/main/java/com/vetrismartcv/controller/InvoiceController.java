package com.vetrismartcv.controller;

import com.vetrismartcv.model.Invoice;
import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.InvoiceRepository;
import com.vetrismartcv.service.InvoiceService;
import com.vetrismartcv.service.UserService;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/invoices")
public class InvoiceController {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("dd MMM yyyy");

    private final InvoiceRepository invoiceRepository;
    private final InvoiceService invoiceService;
    private final UserService userService;

    public InvoiceController(InvoiceRepository invoiceRepository,
                             InvoiceService invoiceService,
                             UserService userService) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceService = invoiceService;
        this.userService = userService;
    }

    /** List the logged-in user's invoices for the dashboard "Billing" panel. */
    @GetMapping
    public ResponseEntity<?> myInvoices(HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("success", false, "message", "Please login first."));
        }

        User user = userService.getById(userId).orElse(null);
        invoiceService.generateMissingPaidInvoicesForUser(user);

        List<Map<String, Object>> invoices = invoiceRepository
                .findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(inv -> Map.<String, Object>of(
                        "id", inv.getId(),
                        "invoiceNumber", inv.getInvoiceNumber(),
                        "plan", inv.getPlan(),
                        "amount", inv.getAmount(),
                        "currency", inv.getCurrency(),
                        "date", inv.getCreatedAt().format(FMT),
                        "downloadUrl", "/api/invoices/" + inv.getId() + "/download"
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(Map.of("success", true, "invoices", invoices));
    }

    /** Download a single invoice as PDF. Scoped to the logged-in user only. */
    @GetMapping("/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id, HttpSession session) {
        Long userId = (Long) session.getAttribute("userId");
        if (userId == null) {
            return ResponseEntity.status(401).build();
        }

        Invoice invoice = invoiceRepository.findByIdAndUserId(id, userId).orElse(null);
        if (invoice == null || invoice.getPdfData() == null) {
            return ResponseEntity.notFound().build();
        }

        String fileName = invoice.getInvoiceNumber() + ".pdf";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(invoice.getPdfData());
    }
}
