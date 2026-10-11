package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

/**
 * One country-level sanctions entry. Deliberately NOT a fuzzy-match target —
 * country names are matched exactly against {@link #aliases}, because there
 * are only a handful of these and inventing fuzzy matching here would
 * reintroduce the same false-positive risk the entity-name screening had
 * ("Miranda Shipping" matching "Iran").
 */
@Document(collection = "sanctioned_countries")
public class SanctionedCountry {

    @Id
    private String id;

    private String isoCode;          // e.g. "IR"
    private String name;             // canonical display name
    private List<String> aliases;    // exact-match variants seen in real documents
    private Tier tier;
    private ListType listType;       // which regime this entry comes from - see note below
    private String source;           // URL this entry was verified against
    private String verifiedDate;     // ISO date this classification was last checked

    /**
     * OFAC sanctions and FATF AML/CFT risk are different regimes that answer
     * different questions - conflating them would misstate what's actually
     * true about a country. A country on the FATF grey list (e.g. Vietnam,
     * Kenya) is NOT sanctioned; transacting with it is not restricted, it
     * just needs enhanced due diligence. Calling that "sanctioned" would be
     * as wrong as the "Miranda Shipping" false positive was - a confident,
     * incorrect compliance signal.
     */
    public enum ListType {
        /** OFAC sanctions programs - transacting may be restricted or illegal. */
        OFAC_SANCTIONS,
        /** FATF AML/CFT risk lists - not sanctioned; needs enhanced due diligence. */
        FATF_AML_RISK,
        /**
         * The bank's own uploaded list - not attributed to OFAC or FATF,
         * because it may not match either exactly (a bank's internal policy
         * can flag countries neither list does, or use its own risk tiers).
         * Saying "OFAC sanctions" about bank-sourced data would misstate
         * where the classification actually came from.
         */
        BANK_PROVIDED
    }

    public enum Tier {
        /** OFAC: broad, multi-sector embargo - essentially all transactions restricted. */
        COMPREHENSIVE,
        /** OFAC: specific sectors/entities restricted - not a blanket ban. */
        SECTORAL,
        /** FATF: "High-Risk Jurisdictions subject to a Call for Action" - the black list. */
        FATF_BLACKLIST,
        /** FATF: "Jurisdictions under Increased Monitoring" - the grey list. */
        FATF_GREYLIST,
        /** Bank's own list: flagged as sanctioned per the bank's policy. */
        BANK_SANCTIONED,
        /** Bank's own list: flagged as high-risk per the bank's policy. */
        BANK_HIGH_RISK
    }

    public SanctionedCountry() {}

    public SanctionedCountry(String isoCode, String name, List<String> aliases,
                              Tier tier, ListType listType, String source, String verifiedDate) {
        this.isoCode = isoCode;
        this.name = name;
        this.aliases = aliases;
        this.tier = tier;
        this.listType = listType;
        this.source = source;
        this.verifiedDate = verifiedDate;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getIsoCode() { return isoCode; }
    public void setIsoCode(String isoCode) { this.isoCode = isoCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<String> getAliases() { return aliases; }
    public void setAliases(List<String> aliases) { this.aliases = aliases; }

    public Tier getTier() { return tier; }
    public void setTier(Tier tier) { this.tier = tier; }

    public ListType getListType() { return listType; }
    public void setListType(ListType listType) { this.listType = listType; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVerifiedDate() { return verifiedDate; }
    public void setVerifiedDate(String verifiedDate) { this.verifiedDate = verifiedDate; }
}
