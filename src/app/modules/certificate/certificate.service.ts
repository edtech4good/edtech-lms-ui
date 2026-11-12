import { HttpBackend, HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FAILURES_SHOWN_BY_CALLER } from 'src/app/interceptors/error-context';
import { CoreService } from 'src/app/services/core.service';
import { Candidate, CertificateRecord, CertificateScope, IssueAnswer, VerifyAnswer } from './certificate';

export interface ScopeRequest {
  curriculumid: string;
  scope: CertificateScope;
  scopeid: string;
}

/**
 * The five certificate routes of central, plus the public check. Every staff screen says its own failures (a 502 when the
 * learning server could not be asked is one banner on the page), so the error interceptor stays quiet for them.
 */
@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly http = inject(HttpClient);
  private readonly rawHttp = new HttpClient(inject(HttpBackend));
  private readonly core = inject(CoreService);

  private readonly quiet = () => ({ context: new HttpContext().set(FAILURES_SHOWN_BY_CALLER, true) });

  candidates(request: ScopeRequest & { standardid?: string }): Observable<Candidate[]> {
    return this.http
      .post<{ data: Candidate[] }>(`${this.core.CORE_API()}certificate/candidates`, request, this.quiet())
      .pipe(map((r) => r.data));
  }

  issue(request: ScopeRequest & { studentids: string[] }): Observable<IssueAnswer> {
    return this.http.post<{ data: IssueAnswer }>(`${this.core.CORE_API()}certificate/issue`, request, this.quiet()).pipe(map((r) => r.data));
  }

  revoke(certificateid: string, reason: string): Observable<CertificateRecord> {
    return this.http
      .post<{ data: CertificateRecord }>(`${this.core.CORE_API()}certificate/${certificateid}/revoke`, { reason }, this.quiet())
      .pipe(map((r) => r.data));
  }

  get(certificateid: string): Observable<CertificateRecord> {
    return this.http.get<{ data: CertificateRecord }>(`${this.core.CORE_API()}certificate/${certificateid}`, this.quiet()).pipe(map((r) => r.data));
  }

  forStudent(studentid: string): Observable<CertificateRecord[]> {
    return this.http.get<{ data: CertificateRecord[] }>(`${this.core.CORE_API()}certificate/student/${studentid}`, this.quiet()).pipe(map((r) => r.data));
  }

  /**
   * The public check. It goes through a client with NO interceptors, so it never carries the Authorization header (even from a
   * browser that is signed in) and a 404 is the page's own "no certificate has this code", not a toast.
   */
  verify(shortcode: string): Observable<VerifyAnswer> {
    return this.rawHttp
      .get<{ data: VerifyAnswer }>(`${this.core.CORE_API()}certificates/verify/${encodeURIComponent(shortcode)}`)
      .pipe(map((r) => r.data));
  }
}
