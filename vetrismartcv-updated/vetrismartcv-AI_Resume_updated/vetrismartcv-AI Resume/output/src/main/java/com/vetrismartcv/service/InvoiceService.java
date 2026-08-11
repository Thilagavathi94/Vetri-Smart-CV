package com.vetrismartcv.service;

import com.vetrismartcv.model.Invoice;
import com.vetrismartcv.model.Payment;
import com.vetrismartcv.model.User;
import com.vetrismartcv.repository.InvoiceRepository;
import com.vetrismartcv.repository.PaymentRepository;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

@Service
public class InvoiceService {

    private static final Logger log = LoggerFactory.getLogger(InvoiceService.class);

    private static final DateTimeFormatter DISPLAY_FMT =
            DateTimeFormatter.ofPattern("dd MMM yyyy, hh:mm a");

    private final InvoiceRepository invoiceRepository;
    private final PaymentRepository paymentRepository;

    public InvoiceService(InvoiceRepository invoiceRepository, PaymentRepository paymentRepository) {
        this.invoiceRepository = invoiceRepository;
        this.paymentRepository = paymentRepository;
    }

    /**
     * Generates and stores a PDF invoice for a successfully verified payment.
     * Safe to call only once per Payment — checks for an existing invoice first.
     */
    public Invoice generateForPayment(Payment payment, User user) {
        return invoiceRepository.findByPaymentId(payment.getId())
                .orElseGet(() -> {
                    try {
                        String invoiceNumber = buildInvoiceNumber(payment);
                        byte[] pdf = renderInvoicePdf(invoiceNumber, payment, user);

                        Invoice invoice = Invoice.builder()
                                .invoiceNumber(invoiceNumber)
                                .userId(payment.getUserId())
                                .paymentId(payment.getId())
                                .plan(payment.getPlan())
                                .amount(payment.getAmount())
                                .currency(payment.getCurrency())
                                .razorpayPaymentId(payment.getRazorpayPaymentId())
                                .pdfData(pdf)
                                .build();

                        return invoiceRepository.save(invoice);
                    } catch (IOException e) {
                        throw new RuntimeException("Failed to generate invoice PDF", e);
                    }
                });
    }

    public void generateMissingPaidInvoicesForUser(User user) {
        if (user == null || user.getId() == null) {
            return;
        }

        List<Payment> paidPayments = paymentRepository
                .findByUserIdAndStatusIgnoreCaseOrderByPaidAtDesc(user.getId(), "PAID");

        for (Payment payment : paidPayments) {
            try {
                Invoice invoice = generateForPayment(payment, user);
                if (invoice.getId() != null && !invoice.getId().equals(payment.getInvoiceId())) {
                    payment.setInvoiceId(invoice.getId());
                    paymentRepository.save(payment);
                }
            } catch (RuntimeException ex) {
                log.warn("Unable to backfill invoice for paid payment {} of user {}.", payment.getId(), user.getId(), ex);
            }
        }
    }

    private String buildInvoiceNumber(Payment payment) {
        int year = LocalDateTime.now().getYear();
        return String.format("VSCV-%d-%06d", year, payment.getId());
    }

    private byte[] renderInvoicePdf(String invoiceNumber, Payment payment, User user) throws IOException {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage(PDRectangle.A4);
            doc.addPage(page);

            PDType1Font bold = PDType1Font.HELVETICA_BOLD;
            PDType1Font regular = PDType1Font.HELVETICA;

            float margin = 50;
            float y = page.getMediaBox().getHeight() - margin;
            float width = page.getMediaBox().getWidth() - 2 * margin;

            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {

                // Header
                cs.setFont(bold, 20);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("VetriSmartCV");
                cs.endText();

                cs.setFont(regular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y - 16);
                cs.showText("Tax Invoice / Payment Receipt");
                cs.endText();

                cs.setFont(regular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin + width - 180, y);
                cs.showText("Invoice #: " + invoiceNumber);
                cs.endText();

                cs.beginText();
                cs.newLineAtOffset(margin + width - 180, y - 14);
                cs.showText("Date: " + LocalDateTime.now().format(DISPLAY_FMT));
                cs.endText();

                y -= 50;
                cs.setLineWidth(0.7f);
                cs.moveTo(margin, y);
                cs.lineTo(margin + width, y);
                cs.stroke();
                y -= 24;

                // Bill To
                cs.setFont(bold, 11);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Billed To");
                cs.endText();
                y -= 16;

                cs.setFont(regular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText(safe(user != null ? user.getName() : "Customer"));
                cs.endText();
                y -= 14;

                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText(safe(user != null ? user.getEmail() : ""));
                cs.endText();
                y -= 34;

                // Table header
                cs.setFont(bold, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Description");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(margin + width - 200, y);
                cs.showText("Payment ID");
                cs.endText();
                cs.beginText();
                cs.newLineAtOffset(margin + width - 60, y);
                cs.showText("Amount");
                cs.endText();
                y -= 8;
                cs.moveTo(margin, y);
                cs.lineTo(margin + width, y);
                cs.stroke();
                y -= 20;

                // Table row
                cs.setFont(regular, 10);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText(planLabel(payment.getPlan()) + " Plan Subscription");
                cs.endText();

                cs.beginText();
                cs.newLineAtOffset(margin + width - 200, y);
                cs.showText(safe(payment.getRazorpayPaymentId()));
                cs.endText();

                cs.beginText();
                cs.newLineAtOffset(margin + width - 60, y);
                cs.showText(formatAmount(payment.getAmount(), payment.getCurrency()));
                cs.endText();

                y -= 30;
                cs.moveTo(margin, y);
                cs.lineTo(margin + width, y);
                cs.stroke();
                y -= 24;

                // Total
                cs.setFont(bold, 12);
                cs.beginText();
                cs.newLineAtOffset(margin + width - 160, y);
                cs.showText("Total Paid: " + formatAmount(payment.getAmount(), payment.getCurrency()));
                cs.endText();

                y -= 40;
                cs.setFont(regular, 9);
                cs.beginText();
                cs.newLineAtOffset(margin, y);
                cs.showText("Status: PAID   |   Order ID: " + safe(payment.getRazorpayOrderId()));
                cs.endText();

                // Footer
                cs.setFont(regular, 8);
                cs.beginText();
                cs.newLineAtOffset(margin, margin - 10);
                cs.showText("This is a system-generated invoice from VetriSmartCV and does not require a signature.");
                cs.endText();
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.save(out);
            return out.toByteArray();
        }
    }

    private String planLabel(String plan) {
        if (plan == null) return "";
        return plan.substring(0, 1).toUpperCase(Locale.ROOT) + plan.substring(1).toLowerCase(Locale.ROOT);
    }

    /** amount is stored in whole rupees (not paise) — matches how the dashboard and invoice page display it. */
    private String formatAmount(Integer amount, String currency) {
        if (amount == null) return "";
        double value = amount;
        String symbol = "INR".equalsIgnoreCase(currency) ? "Rs. " : (currency + " ");
        return symbol + String.format(Locale.US, "%,.2f", value);
    }

    private String safe(String value) {
        if (value == null) {
            return "";
        }
        return value.replaceAll("[^\\x20-\\x7E]", "");
    }
}