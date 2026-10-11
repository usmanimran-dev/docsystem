package com.edms.examination.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FieldNormalizerTest {

    private final FieldNormalizer normalizer = new FieldNormalizer();

    private void assertSame(String field, String a, String b) {
        assertEquals(normalizer.normalize(field, a), normalizer.normalize(field, b),
            field + ": \"" + a + "\" and \"" + b + "\" should normalise the same");
    }

    private void assertDifferent(String field, String a, String b) {
        assertNotEquals(normalizer.normalize(field, a), normalizer.normalize(field, b),
            field + ": \"" + a + "\" and \"" + b + "\" should NOT normalise the same");
    }

    // --- Names: UCP 600 14(d) - need not be identical, must not conflict ---

    @Test
    void companySuffixesDoNotMakeADiscrepancy() {
        assertSame("beneficiary", "ABC Trading Co. Ltd.", "ABC Trading Company Limited");
        assertSame("applicant", "Messrs. Global Textiles (Pvt) Ltd", "GLOBAL TEXTILES PRIVATE LIMITED");
        assertSame("issuingBank", "Standard Chartered Bank", "STANDARD CHARTERED BANK");
    }

    @Test
    void genuinelyDifferentPartiesStillDiffer() {
        assertDifferent("beneficiary", "ABC Trading Co. Ltd.", "XYZ Exports Ltd.");
    }

    @Test
    void anAllSuffixNameDoesNotCollapseToEmpty() {
        assertNotNull(normalizer.normalize("beneficiary", "M/S Trading Co Ltd"));
        assertFalse(normalizer.normalize("beneficiary", "M/S Trading Co Ltd").isEmpty());
    }

    // --- Amounts ---

    @Test
    void thousandsSeparatorsAndTrailingZerosAreIgnored() {
        assertSame("amount", "50,000.00", "50000");
        assertSame("lcAmount", "1,250,000.00", "1250000");
    }

    @Test
    void europeanDecimalCommaIsUnderstood() {
        assertSame("lcAmount", "125000,00", "125000.00");
    }

    @Test
    void differentAmountsStillDiffer() {
        assertDifferent("amount", "50,000.00", "50,001.00");
    }

    @Test
    void unreadableAmountReturnsNull() {
        assertNull(normalizer.normalize("amount", "N/A"));
    }

    // --- Dates ---

    @Test
    void swiftCompactAndMonthNameDatesAgree() {
        assertSame("latestShipmentDate", "260925", "25-SEP-2026");
        assertSame("expiryDate", "25 September 2026", "2026-09-25");
    }

    @Test
    void uppercaseMonthNamesParse() {
        assertEquals("2026-12-25", normalizer.normalize("issueDate", "25-DEC-2026"));
    }

    @Test
    void ambiguousNumericDateIsNotGuessed() {
        // 05/04/2026 is 5 April or 4 May depending on convention - refuse to pick.
        assertNull(normalizer.normalize("issueDate", "05/04/2026"));
    }

    @Test
    void unambiguousNumericDateStillParses() {
        assertEquals("2026-09-25", normalizer.normalize("issueDate", "25/09/2026"));
    }

    // --- Codes ---

    @Test
    void hsCodeSeparatorsAreIgnored() {
        assertSame("hsCode", "6109.10", "610910");
    }

    @Test
    void currencyIsCaseInsensitive() {
        assertSame("currency", "usd", "USD");
    }

    // --- Ports ---

    @Test
    void trailingCountryOnAPortIsIgnored() {
        assertSame("portOfLoading", "Jebel Ali, UAE", "JEBEL ALI");
    }

    @Test
    void differentPortsStillDiffer() {
        assertDifferent("portOfDischarge", "Karachi", "Dubai");
    }

    // --- Near-miss detection ---

    @Test
    void oneCharacterDifferenceIsDetected() {
        assertTrue(normalizer.differsByOneCharacter("9247431", "9247430"));
        assertFalse(normalizer.differsByOneCharacter("9247431", "9247431"));
        assertFalse(normalizer.differsByOneCharacter("9247431", "1234567"));
        assertFalse(normalizer.differsByOneCharacter("9247431", "924743"));
    }

    @Test
    void blankValuesNormaliseToNull() {
        assertNull(normalizer.normalize("beneficiary", ""));
        assertNull(normalizer.normalize("beneficiary", "   "));
        assertNull(normalizer.normalize("beneficiary", null));
    }
}
