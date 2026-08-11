package com.vetrismartcv.config;

import com.vetrismartcv.service.UserService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserService userService;
    private final JdbcTemplate jdbcTemplate;

    public DataInitializer(UserService userService, JdbcTemplate jdbcTemplate) {
        this.userService = userService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        relaxLegacyPaymentInvoiceColumn();
        expandLegacyInvoicePdfColumn();
        relaxLegacyInvoiceNoColumn();
        relaxLegacyInvoiceCustomerColumn();
        userService.ensureDefaultAdminAccount();
    }

    private void relaxLegacyPaymentInvoiceColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE payments MODIFY invoice_id BIGINT NULL");
        } catch (Exception mysqlEx) {
            try {
                jdbcTemplate.execute("ALTER TABLE payments ALTER COLUMN invoice_id BIGINT NULL");
            } catch (Exception h2Ex) {
                log.debug("No legacy payments.invoice_id constraint to relax.");
            }
        }
    }

    private void expandLegacyInvoicePdfColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE invoices MODIFY pdf_data LONGBLOB");
        } catch (Exception mysqlEx) {
            try {
                jdbcTemplate.execute("ALTER TABLE invoices ALTER COLUMN pdf_data BLOB");
            } catch (Exception h2Ex) {
                log.debug("No legacy invoices.pdf_data column to expand.");
            }
        }
    }

    private void relaxLegacyInvoiceNoColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE invoices MODIFY invoice_no VARCHAR(255) NULL");
        } catch (Exception mysqlEx) {
            try {
                jdbcTemplate.execute("ALTER TABLE invoices ALTER COLUMN invoice_no VARCHAR(255) NULL");
            } catch (Exception h2Ex) {
                log.debug("No legacy invoices.invoice_no constraint to relax.");
            }
        }
    }

    private void relaxLegacyInvoiceCustomerColumn() {
        try {
            jdbcTemplate.execute("ALTER TABLE invoices MODIFY customer_id BIGINT NULL");
        } catch (Exception mysqlEx) {
            try {
                jdbcTemplate.execute("ALTER TABLE invoices ALTER COLUMN customer_id BIGINT NULL");
            } catch (Exception h2Ex) {
                log.debug("No legacy invoices.customer_id constraint to relax.");
            }
        }
    }
}
