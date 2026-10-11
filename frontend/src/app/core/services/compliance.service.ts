import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CountryCheckResult {
  checked: string;
  /** True for BOTH an OFAC sanctions hit and a FATF AML-risk hit — see listType to tell them apart. */
  flagged: boolean;
  isoCode?: string;
  name?: string;
  /** Which regime flagged it. A FATF entry is NOT sanctioned — see backend SanctionedCountry.ListType. */
  listType?: 'OFAC_SANCTIONS' | 'FATF_AML_RISK' | 'BANK_PROVIDED';
  tier?: 'COMPREHENSIVE' | 'SECTORAL' | 'FATF_BLACKLIST' | 'FATF_GREYLIST' | 'BANK_SANCTIONED' | 'BANK_HIGH_RISK';
  severity?: 'critical' | 'warning';
  /** Correctly worded server-side — e.g. never calls a FATF grey-list country "sanctioned". Use this, don't reconstruct it. */
  message?: string;
  source?: string;
  verifiedDate?: string;
  checkedAt: string;
  /** Set when the check could not run (service down, misconfigured). Component should report this as a skipped check, not a pass. */
  error?: string;
}

export interface EntityCandidate {
  id: string;
  name: string;
  score: number;
  isMatch: boolean;
  topics: string[] | null;
  datasets: string[] | null;
}

export interface EntityCheckResult {
  checked: string;
  schema: string;
  screened: boolean;
  hasMatch: boolean;
  candidates: EntityCandidate[];
  error?: string;
}

export interface HsCodePriceCheckResult {
  checked: string;
  declaredPrice: number;
  found: boolean;
  flagged: boolean;
  hsCode?: string;
  description?: string;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  direction?: 'UNDER' | 'OVER';
  severity?: 'warning';
  message?: string;
  source?: string;
  verifiedDate?: string;
  checkedAt: string;
}

export interface HsCodeSanctionCheckResult {
  checked: string;
  checkedCountry: string;
  /** True only when this exact HS code + country combination is on the export-control table. */
  flagged: boolean;
  hsCode?: string;
  countryIsoCode?: string;
  countryName?: string;
  description?: string;
  level?: 'EXPORT_CONTROLLED' | 'RESTRICTED';
  severity?: 'critical' | 'warning';
  message?: string;
  source?: string;
  verifiedDate?: string;
  checkedAt: string;
  /** Set when the check could not run (service down). Component should report this as a skipped check, not a pass. */
  error?: string;
}

export interface PortCheckResult {
  checked: string;
  flagged: boolean;
  reason?: 'COUNTRY_SANCTIONED' | 'PORT_SANCTIONED';
  countryIsoCode?: string;
  countryName?: string;
  portName?: string;
  tier?: string;
  severity?: 'critical' | 'warning';
  message?: string;
  source?: string;
  verifiedDate?: string;
  checkedAt: string;
}

export interface StoredPort {
  id: string;
  unlocode: string;
  portName: string;
  tier: string;
  source: string;
  verifiedDate: string;
}

export interface PortImportRow {
  lineNumber: number;
  unlocode: string;
  outcome: 'ADDED' | 'UPDATED' | 'SKIPPED';
  reason: string | null;
}

export interface PortImportResult {
  filename: string;
  importedAt: string;
  totalRows: number;
  added: number;
  updated: number;
  skipped: number;
  rows: PortImportRow[];
}

export interface StoredCountry {
  id: string;
  isoCode: string;
  name: string;
  aliases: string[];
  tier: string;
  listType: string;
  source: string;
  verifiedDate: string;
}

export interface CountryImportRow {
  lineNumber: number;
  isoCode: string;
  outcome: 'ADDED' | 'UPDATED' | 'SKIPPED';
  reason: string | null;
}

export interface CountryImportResult {
  filename: string;
  importedAt: string;
  totalRows: number;
  added: number;
  updated: number;
  skipped: number;
  rows: CountryImportRow[];
}

/**
 * Talks to edms-examination-service — a separate Spring Boot service, not
 * Imad's JAR. Real OFAC-sourced country data, exact alias matching (not the
 * substring matching that used to false-flag "Miranda Shipping" on "iran").
 *
 * If this service isn't running, the check fails soft: sanctioned defaults
 * to false rather than blocking the whole analysis pipeline. That's a
 * deliberate choice for a demo/prototype stage — a real deployment should
 * decide explicitly whether "compliance check unavailable" should block
 * processing or just warn, and that's a policy call, not a code default.
 */
@Injectable({
  providedIn: 'root'
})
export class ComplianceService {
  private readonly baseUrl = environment.examineApiUrl;

  constructor(private http: HttpClient) {}

  checkCountry(value: string): Observable<CountryCheckResult> {
    const url = `${this.baseUrl}/compliance/check-country?value=${encodeURIComponent(value)}`;

    return this.http.get<CountryCheckResult>(url).pipe(
      catchError((err) => {
        console.warn('Compliance service unreachable — country check skipped', err);
        return of<CountryCheckResult>({
          checked: value,
          flagged: false,
          checkedAt: new Date().toISOString(),
          error: err.status === 0
            ? 'The examination service is not reachable — no country check was performed'
            : `Country check failed (server returned ${err?.status ?? 'an error'}) — no check was performed`
        });
      })
    );
  }

  /**
   * Screens a name against real watchlists via OpenSanctions, with proper
   * scored matching rather than the substring check this replaces.
   *
   * Errors are NOT swallowed here, unlike checkCountry. The country list is
   * local data that either matches or doesn't; this calls a metered external
   * provider, so "quota exhausted" or "provider down" must be visible —
   * silently reporting "no match" when nothing was actually screened would
   * be the most dangerous possible failure mode for a compliance check.
   */
  checkEntity(name: string, schema: 'Person' | 'Company' = 'Company'): Observable<EntityCheckResult> {
    const url = `${this.baseUrl}/compliance/check-entity`
      + `?name=${encodeURIComponent(name)}&schema=${encodeURIComponent(schema)}`;
    return this.http.get<EntityCheckResult>(url);
  }

  /**
   * HS code price-range check, per the 2026-09-07 meeting: flags possible
   * under/over-invoicing on trade documents (LCs, commercial invoices).
   * Automatic, like checkCountry - it's a local DB lookup with no external
   * quota to worry about, so it fails soft the same way rather than
   * surfacing an error like checkEntity does.
   */
  checkHsCodePrice(hsCode: string, price: number): Observable<HsCodePriceCheckResult> {
    const url = `${this.baseUrl}/compliance/check-hscode-price`
      + `?hscode=${encodeURIComponent(hsCode)}&price=${encodeURIComponent(price)}`;

    return this.http.get<HsCodePriceCheckResult>(url).pipe(
      catchError((err) => {
        console.warn('Compliance service unreachable — HS code price check skipped', err);
        return of<HsCodePriceCheckResult>({
          checked: hsCode,
          declaredPrice: price,
          found: false,
          flagged: false,
          checkedAt: new Date().toISOString()
        });
      })
    );
  }

  /**
   * HS code + destination country export-control check, per Imad (senior
   * dev, 2026-09-17) - a separate signal from checkHsCodePrice: that one
   * flags an implausible price, this one flags the trade itself as
   * restricted regardless of price. Automatic and fails soft like the other
   * local-DB checks (country/port/HS price) - not fail-loud like
   * checkEntity, since this is a local lookup with no external quota.
   */
  checkHsCodeSanction(hsCode: string, country: string): Observable<HsCodeSanctionCheckResult> {
    const url = `${this.baseUrl}/compliance/check-hscode-sanction`
      + `?hscode=${encodeURIComponent(hsCode)}&country=${encodeURIComponent(country)}`;

    return this.http.get<HsCodeSanctionCheckResult>(url).pipe(
      catchError((err) => {
        console.warn('Compliance service unreachable — HS code sanction check skipped', err);
        return of<HsCodeSanctionCheckResult>({
          checked: hsCode,
          checkedCountry: country,
          flagged: false,
          checkedAt: new Date().toISOString(),
          error: err.status === 0
            ? 'The examination service is not reachable — no HS code sanction check was performed'
            : `HS code sanction check failed (server returned ${err?.status ?? 'an error'}) — no check was performed`
        });
      })
    );
  }

  /**
   * Port check, per the 2026-09-08 discussion: two independent signals -
   * the port's country being sanctioned (derived server-side from the
   * UN/LOCODE's first two letters), or the port itself being bank-flagged
   * as a known high-risk hub. Automatic and fails soft, same reasoning as
   * checkCountry - local DB lookups, no external quota.
   */
  checkPort(unlocode: string): Observable<PortCheckResult> {
    const url = `${this.baseUrl}/compliance/check-port?value=${encodeURIComponent(unlocode)}`;

    return this.http.get<PortCheckResult>(url).pipe(
      catchError((err) => {
        console.warn('Compliance service unreachable — port check skipped', err);
        return of<PortCheckResult>({
          checked: unlocode,
          flagged: false,
          checkedAt: new Date().toISOString()
        });
      })
    );
  }

  getAllPorts(): Observable<StoredPort[]> {
    return this.http.get<StoredPort[]>(`${this.baseUrl}/compliance/ports`);
  }

  /** Bank's own high-risk port file. Merges by unlocode, same as importCountries. */
  importPorts(file: File): Observable<PortImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PortImportResult>(`${this.baseUrl}/compliance/ports/import`, formData);
  }

  getAllCountries(): Observable<StoredCountry[]> {
    return this.http.get<StoredCountry[]>(`${this.baseUrl}/compliance/countries`);
  }

  /**
   * Uploads the bank's own country risk file. Merges into the existing
   * table by iso_code on the backend — this does not replace what's
   * already there, see CountryImportService for the exact behaviour.
   */
  importCountries(file: File): Observable<CountryImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<CountryImportResult>(`${this.baseUrl}/compliance/countries/import`, formData);
  }
}
