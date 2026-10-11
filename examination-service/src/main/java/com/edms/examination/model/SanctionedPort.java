package com.edms.examination.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * One directly-flagged port entry - a real, individually-curated sanctioned
 * or high-risk port (e.g. a port inside Iran, or a known transshipment hub
 * like Dubai/Jebel Ali that isn't itself in a comprehensively-sanctioned
 * country). Imad's direction (2026-09-14): port risk should be checked
 * against real per-port data here FIRST, not derived from the port's
 * country alone - the country-derivation in PortService (UN/LOCODE's first
 * two letters are the ISO country code) stays as a second, independent
 * signal, not a substitute for having actual port-level data.
 *
 * Populated two ways, same "merge, don't replace" pattern as
 * SanctionedCountry: {@link com.edms.examination.config.PortDataSeeder}
 * seeds sample/test data on first boot (offline), and the bank's own real
 * list can be imported via CSV later (online) - see PortImportService.
 */
@Document(collection = "sanctioned_ports")
public class SanctionedPort {

    @Id
    private String id;

    private String unlocode;   // e.g. "AEJEA" (Jebel Ali) - first 2 letters are the ISO country code
    private String portName;   // e.g. "Jebel Ali"
    private Tier tier;
    private String source;         // e.g. "Bank-provided compliance data"
    private String verifiedDate;   // ISO date this entry was last checked

    /**
     * Two tiers, per Imad (2026-09-14): a port can now be flagged directly
     * in this table as itself SANCTIONED or HIGH_RISK, independent of the
     * country-derivation check in PortService - that derivation stays as
     * the OTHER, separate signal (a port whose country is sanctioned), not
     * a replacement for having real per-port data. SANCTIONED is critical
     * severity, HIGH_RISK is warning - same split as SanctionedCountry's
     * six-tier scheme collapses down to.
     */
    public enum Tier {
        SANCTIONED,
        HIGH_RISK
    }

    public SanctionedPort() {}

    public SanctionedPort(String unlocode, String portName, Tier tier, String source, String verifiedDate) {
        this.unlocode = unlocode;
        this.portName = portName;
        this.tier = tier;
        this.source = source;
        this.verifiedDate = verifiedDate;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUnlocode() { return unlocode; }
    public void setUnlocode(String unlocode) { this.unlocode = unlocode; }

    public String getPortName() { return portName; }
    public void setPortName(String portName) { this.portName = portName; }

    public Tier getTier() { return tier; }
    public void setTier(Tier tier) { this.tier = tier; }

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getVerifiedDate() { return verifiedDate; }
    public void setVerifiedDate(String verifiedDate) { this.verifiedDate = verifiedDate; }
}
