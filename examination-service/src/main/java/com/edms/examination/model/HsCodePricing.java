package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One HS Code's expected price range, used to flag under/over-invoicing on
 * trade documents (LCs, commercial invoices). Deliberately per-HS-code only,
 * not per-country-of-origin - see the note on ComplianceService for why that
 * scope was chosen.
 */
@Document(collection = "hs_code_pricing")
public class HsCodePricing {

    @Id
    private String id;

    private String hsCode;          // e.g. "6109.10"
    private String description;     // e.g. "Cotton T-Shirts"
    private double minPrice;
    private double maxPrice;
    private String currency;        // e.g. "USD"
    private String source;          // where this range came from
    private String verifiedDate;    // ISO date this range was last checked

    public HsCodePricing() {}

    public HsCodePricing(String hsCode, String description, double minPrice, double maxPrice,
                          String currency, String source, String verifiedDate) {
        this.hsCode = hsCode;
        this.description = description;
        this.minPrice = minPrice;
        this.maxPrice = maxPrice;
        this.currency = currency;
        this.source = source;
        this.verifiedDate = verifiedDate;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getHsCode() { return hsCode; }
    public void setHsCode(String hsCode) { this.hsCode = hsCode; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public double getMinPrice() { return minPrice; }
    public void setMinPrice(double minPrice) { this.minPrice = minPrice; }

    public double getMaxPrice() { return maxPrice; }
    public void setMaxPrice(double maxPrice) { this.maxPrice = maxPrice; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVerifiedDate() { return verifiedDate; }
    public void setVerifiedDate(String verifiedDate) { this.verifiedDate = verifiedDate; }
}
