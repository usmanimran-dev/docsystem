import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface RouteDeviationResult {
  checked: string;
  declaredPortOfLoading: string;
  declaredPortOfDischarge: string;
  flagged: boolean;
  vesselName?: string;
  actualLastPort?: string;
  actualLastPortUnlocode?: string;
  actualDestination?: string;
  actualDestinationUnlocode?: string;
  loadingMismatch?: boolean;
  dischargeMismatch?: boolean;
  loadingMessage?: string;
  dischargeMessage?: string;
  error?: string;
}

export interface FlagStateResult {
  checked: string;
  flagged: boolean;
  vesselName?: string;
  flagCountry?: string;
  flagCountryIso?: string;
  tier?: string;
  listType?: string;
  severity?: 'critical' | 'warning';
  message?: string;
  source?: string;
  verifiedDate?: string;
  error?: string;
}

export interface ScreenedParty {
  role: 'registeredOwner' | 'manager';
  name: string;
  hasMatch: boolean | null;
  candidates: unknown[] | null;
  error?: string;
}

export interface OwnershipScreeningResult {
  checked: string;
  flagged: boolean;
  vesselName?: string;
  registeredOwner?: string;
  manager?: string;
  screened?: ScreenedParty[];
  severity?: 'critical';
  message?: string;
  error?: string;
}

/**
 * Talks to edms-examination-service's /vessel endpoints, which proxy Data
 * Docked's live AIS API.
 *
 * Every call here costs a real credit against a metered third-party quota
 * (20-credit trial as of 2026-09-09), unlike the country/port/HS-code checks
 * which are local DB lookups. Callers must only fire this when a document
 * actually has both a vessel IMO and a declared route - see the guard in
 * document-reader.component.ts.
 *
 * Fails soft like checkCountry rather than surfacing an error like
 * checkEntity: a route check that couldn't run should not blow up an
 * otherwise-complete analysis, and the backend already returns a structured
 * "error" field when it has no data for a vessel.
 */
@Injectable({
  providedIn: 'root'
})
export class VesselService {
  private readonly baseUrl = environment.examineApiUrl;

  constructor(private http: HttpClient) {}

  checkRouteDeviation(
    imo: string,
    portOfLoading: string,
    portOfDischarge: string
  ): Observable<RouteDeviationResult> {
    const url = `${this.baseUrl}/vessel/check-route`
      + `?imo=${encodeURIComponent(imo)}`
      + `&portOfLoading=${encodeURIComponent(portOfLoading)}`
      + `&portOfDischarge=${encodeURIComponent(portOfDischarge)}`;

    return this.http.get<RouteDeviationResult>(url).pipe(
      catchError((err) => {
        console.warn('Vessel tracking unreachable — route check skipped', err);
        return of<RouteDeviationResult>({
          checked: imo,
          declaredPortOfLoading: portOfLoading,
          declaredPortOfDischarge: portOfDischarge,
          flagged: false,
          error: this.upstreamErrorMessage(err, 'route not checked')
        });
      })
    );
  }

  /** Flag State Check — reuses the Country Sanctions list server-side. */
  checkFlagState(imo: string): Observable<FlagStateResult> {
    const url = `${this.baseUrl}/vessel/check-flag?imo=${encodeURIComponent(imo)}`;

    return this.http.get<FlagStateResult>(url).pipe(
      catchError((err) => {
        console.warn('Vessel tracking unreachable — flag state check skipped', err);
        return of<FlagStateResult>({
          checked: imo,
          flagged: false,
          error: this.upstreamErrorMessage(err, 'flag state not checked')
        });
      })
    );
  }

  /** Ownership/Management Screening — reuses Entity Screening server-side. */
  checkOwnership(imo: string): Observable<OwnershipScreeningResult> {
    const url = `${this.baseUrl}/vessel/check-ownership?imo=${encodeURIComponent(imo)}`;

    return this.http.get<OwnershipScreeningResult>(url).pipe(
      catchError((err) => {
        console.warn('Vessel tracking unreachable — ownership screening skipped', err);
        return of<OwnershipScreeningResult>({
          checked: imo,
          flagged: false,
          error: this.upstreamErrorMessage(err, 'ownership not screened')
        });
      })
    );
  }

  /**
   * GlobalExceptionHandler (backend) already captures the real upstream
   * reason for a Data Docked failure - e.g. "Upstream sanctions provider
   * did not respond: 400 Bad Request: Not enough credits or endpoint in
   * black list" - and puts it in the error response body. Discarding that
   * in favour of a generic "unreachable" string (the previous behaviour)
   * hid the actual cause from anyone reading the UI, exactly the same
   * problem the missing-API-key case already solved correctly. Falls back
   * to a generic message only when there's truly no response body to read
   * (e.g. the request never reached the backend at all).
   */
  private upstreamErrorMessage(err: unknown, fallbackSuffix: string): string {
    const backendMessage = (err as { error?: { message?: string } })?.error?.message;
    return backendMessage ?? `Vessel tracking service unreachable — ${fallbackSuffix}`;
  }
}
