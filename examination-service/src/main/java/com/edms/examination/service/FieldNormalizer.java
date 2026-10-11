package com.edms.examination.service;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import java.util.Set;

/**
 * Turns two raw extracted values into the form they should actually be
 * compared in.
 *
 * This exists because UCP 600 article 14(d) is not a string equality rule:
 * data "need not be identical to, but must not conflict with" data in
 * another document. "ABC Trading Co. Ltd." and "ABC Trading Company
 * Limited" are the same party and must not be reported as a discrepancy -
 * a checker who sees one false conflict stops trusting the whole report.
 *
 * Each field kind normalises differently, so the field name decides the
 * rule. Anything unrecognised falls back to case-folded text.
 */
@Component
public class FieldNormalizer {

    public enum Kind { NAME, AMOUNT, DATE, PORT, CODE, TEXT }

    private static final Set<String> NAME_FIELDS = Set.of(
        "applicant", "beneficiary", "issuingBank", "advisingBank",
        "reimbursingBank", "accountHolder");

    private static final Set<String> AMOUNT_FIELDS = Set.of(
        "amount", "lcAmount", "unitPrice");

    private static final Set<String> DATE_FIELDS = Set.of(
        "date", "issueDate", "expiryDate", "latestShipmentDate");

    private static final Set<String> PORT_FIELDS = Set.of(
        "portOfLoading", "portOfDischarge");

    private static final Set<String> CODE_FIELDS = Set.of(
        "hsCode", "currency", "swiftBic", "vesselImo", "lcNumber",
        "documentId", "accountNumber", "statementId", "applicationReference");

    /**
     * Legal-form suffixes carry no identifying information - the same company
     * is written "Co. Ltd." on one document and "Company Limited" on another
     * as a matter of routine, not as a discrepancy.
     */
    private static final Set<String> COMPANY_SUFFIXES = Set.of(
        "LTD", "LIMITED", "CO", "COMPANY", "PVT", "PRIVATE", "INC",
        "INCORPORATED", "LLC", "LLP", "PLC", "CORP", "CORPORATION",
        "GMBH", "AG", "SA", "BV", "NV", "SARL", "PTE", "FZE", "FZCO",
        "TRADING", "GENERAL");

    /** Honorifics that precede a party name on trade documents. */
    private static final Set<String> NAME_PREFIXES = Set.of("MESSRS", "M/S", "MS");

    public Kind kindOf(String fieldName) {
        if (NAME_FIELDS.contains(fieldName)) return Kind.NAME;
        if (AMOUNT_FIELDS.contains(fieldName)) return Kind.AMOUNT;
        if (DATE_FIELDS.contains(fieldName)) return Kind.DATE;
        if (PORT_FIELDS.contains(fieldName)) return Kind.PORT;
        if (CODE_FIELDS.contains(fieldName)) return Kind.CODE;
        return Kind.TEXT;
    }

    /**
     * Returns null when the value cannot be normalised into its field's
     * expected form - an unparseable date, a non-numeric amount. Callers
     * treat null as "cannot compare" and fall back to review rather than
     * declaring a conflict on what may be an extraction failure.
     */
    public String normalize(String fieldName, String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return switch (kindOf(fieldName)) {
            case NAME -> normalizeName(raw);
            case AMOUNT -> normalizeAmount(raw);
            case DATE -> normalizeDate(raw);
            case PORT -> normalizePort(raw);
            case CODE -> normalizeCode(raw);
            case TEXT -> normalizeText(raw);
        };
    }

    private String normalizeName(String raw) {
        String cleaned = raw.toUpperCase(Locale.ROOT)
            .replaceAll("[.,&/()\\-]", " ")
            .replaceAll("\\s+", " ")
            .trim();

        StringBuilder out = new StringBuilder();
        for (String token : cleaned.split(" ")) {
            if (token.isEmpty()) continue;
            if (NAME_PREFIXES.contains(token) || COMPANY_SUFFIXES.contains(token)) continue;
            if (!out.isEmpty()) out.append(' ');
            out.append(token);
        }

        // Every token was a suffix ("M/S Trading Co Ltd") - keep the cleaned
        // form rather than returning an empty string that matches anything.
        return out.isEmpty() ? cleaned : out.toString();
    }

    /**
     * European decimal comma is common in SWIFT amounts (the :32B: pattern in
     * the extractor already accepts "125000,00"). A comma is the decimal
     * separator only when it is the last separator and exactly two digits
     * follow it; otherwise commas are thousands grouping.
     */
    private String normalizeAmount(String raw) {
        String cleaned = raw.replaceAll("[^0-9,.\\-]", "");
        if (cleaned.isBlank()) return null;

        int lastComma = cleaned.lastIndexOf(',');
        int lastDot = cleaned.lastIndexOf('.');

        if (lastComma > lastDot && cleaned.length() - lastComma == 3) {
            cleaned = cleaned.substring(0, lastComma).replace(",", "")
                   + "." + cleaned.substring(lastComma + 1);
        } else {
            cleaned = cleaned.replace(",", "");
        }

        try {
            // stripTrailingZeros so 50000 and 50000.00 compare equal
            return new BigDecimal(cleaned).stripTrailingZeros().toPlainString();
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * parseCaseInsensitive matters: trade documents write months as "SEP" in
     * all-caps far more often than "Sep", and a case-sensitive MMM silently
     * fails to parse them - which would turn every month-name date into an
     * unreadable value rather than a comparison.
     */
    private static final DateTimeFormatter[] DATE_FORMATS = {
        caseInsensitive("yyyy-MM-dd"),
        caseInsensitive("yyyy/MM/dd"),
        caseInsensitive("dd-MMM-yyyy"),
        caseInsensitive("dd MMM yyyy"),
        caseInsensitive("dd-MMM-yy"),
        caseInsensitive("dd MMMM yyyy"),
        caseInsensitive("dd/MM/yyyy"),
        caseInsensitive("dd-MM-yyyy"),
    };

    private static DateTimeFormatter caseInsensitive(String pattern) {
        return new DateTimeFormatterBuilder()
            .parseCaseInsensitive()
            .appendPattern(pattern)
            .toFormatter(Locale.ENGLISH);
    }

    /**
     * Normalises to ISO yyyy-MM-dd so two documents using different date
     * layouts still compare.
     *
     * Returns null for a day/month-ambiguous numeric date (both parts <= 12,
     * e.g. 05/04/2026) because guessing between DD/MM and MM/DD would invent
     * either a false match or a false conflict. The caller reports those for
     * human review instead.
     */
    private String normalizeDate(String raw) {
        String cleaned = raw.trim().replaceAll("\\s+", " ");

        // SWIFT compact YYMMDD - unambiguous, and the only 6-digit form used.
        if (cleaned.matches("\\d{6}")) {
            try {
                return LocalDate.parse(cleaned, DateTimeFormatter.ofPattern("yyMMdd", Locale.ENGLISH))
                                .toString();
            } catch (DateTimeParseException ignored) {
                return null;
            }
        }

        if (isAmbiguousNumericDate(cleaned)) {
            return null;
        }

        String upper = cleaned.toUpperCase(Locale.ENGLISH);
        for (DateTimeFormatter format : DATE_FORMATS) {
            try {
                return LocalDate.parse(upper, format).toString();
            } catch (DateTimeParseException ignored) {
                // try the next layout
            }
        }
        return null;
    }

    private boolean isAmbiguousNumericDate(String value) {
        String[] parts = value.split("[/\\-]");
        if (parts.length != 3) return false;
        try {
            int first = Integer.parseInt(parts[0]);
            int second = Integer.parseInt(parts[1]);
            return first <= 12 && second <= 12 && first != second;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /**
     * Drops the country suffix that ports routinely carry on one document and
     * not the other ("Jebel Ali, UAE" vs "Jebel Ali"). Code-versus-name
     * resolution is not attempted here - the port table only holds sanctioned
     * ports, so most lookups would miss. DiscrepancyService reports those
     * pairs for review instead of guessing.
     */
    private String normalizePort(String raw) {
        String cleaned = raw.toUpperCase(Locale.ROOT).trim();
        int comma = cleaned.indexOf(',');
        if (comma > 0) {
            cleaned = cleaned.substring(0, comma);
        }
        return cleaned.replaceAll("[^A-Z0-9 ]", " ")
                      .replaceAll("\\s+", " ")
                      .trim();
    }

    /** Strips separators, so "6109.10" and "610910" are the same tariff heading. */
    private String normalizeCode(String raw) {
        return raw.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private String normalizeText(String raw) {
        return raw.toUpperCase(Locale.ROOT)
                  .replaceAll("[^A-Z0-9 ]", " ")
                  .replaceAll("\\s+", " ")
                  .trim();
    }

    /** True when two strings of equal length differ in exactly one position. */
    public boolean differsByOneCharacter(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) {
            if (a.charAt(i) != b.charAt(i) && ++diff > 1) return false;
        }
        return diff == 1;
    }
}
