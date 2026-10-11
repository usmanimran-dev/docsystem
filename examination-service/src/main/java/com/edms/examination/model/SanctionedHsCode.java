package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One HS code + destination country combination that is export-controlled
 * or restricted - e.g. dual-use telecom equipment into Iran, oil/gas
 * exploration equipment into Russia. Deliberately keyed on BOTH fields
 * together: unlike {@link HsCodePricing} (per-HS-code only) or
 * {@link SanctionedCountry} (per-country only), the same HS code is legal to
 * most destinations and only becomes a compliance signal paired with a
 * specific country.
 */
@Document(collection = "sanctioned_hscode_countries")
public class SanctionedHsCode {

    @Id
    private String id;

    private String hsCode;             // e.g. "8517.62"
    private String countryIsoCode;     // e.g. "IR"
    private String countryName;        // e.g. "Iran"
    private String description;        // e.g. "Telecommunications network equipment"
    private String reason;             // why this combination is restricted
    private RestrictionLevel level;
    private String source;
    private String verifiedDate;

    public enum RestrictionLevel {
        /** Export effectively prohibited to this destination - critical. */
        EXPORT_CONTROLLED,
        /** Requires an export license or enhanced review, not an outright denial - warning. */
        RESTRICTED
    }

    public SanctionedHsCode() {}

    public SanctionedHsCode(String hsCode, String countryIsoCode, String countryName, String description,
                             String reason, RestrictionLevel level, String source, String verifiedDate) {
        this.hsCode = hsCode;
        this.countryIsoCode = countryIsoCode;
        this.countryName = countryName;
        this.description = description;
        this.reason = reason;
        this.level = level;
        this.source = source;
        this.verifiedDate = verifiedDate;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHsCode() { return hsCode; }
    public void setHsCode(String hsCode) { this.hsCode = hsCode; }

    public String getCountryIsoCode() { return countryIsoCode; }
    public void setCountryIsoCode(String countryIsoCode) { this.countryIsoCode = countryIsoCode; }

    public String getCountryName() { return countryName; }
    public void setCountryName(String countryName) { this.countryName = countryName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public RestrictionLevel getLevel() { return level; }
    public void setLevel(RestrictionLevel level) { this.level = level; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVerifiedDate() { return verifiedDate; }
    public void setVerifiedDate(String verifiedDate) { this.verifiedDate = verifiedDate; }
}
