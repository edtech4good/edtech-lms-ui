import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { FIELD_ERRORS_INLINE, FORBIDDEN_HANDLED, NOT_FOUND_HANDLED } from 'src/app/interceptors/error-context';
import { CoreService } from 'src/app/services/core.service';
import {
  Country,
  Organisation,
  OrganisationCreate,
  OrganisationPage,
  OrganisationQuery,
  OrganisationWrite,
} from './organisation.model';

@Injectable({ providedIn: 'root' })
export class OrganisationService {
  private readonly http = inject(HttpClient);
  private readonly core = inject(CoreService);

  private url(path = ''): string {
    return `${this.core.CORE_API()}organisation${path}`;
  }

  /** One page, by name order (the API's only order). `pageindex` is 1-based. */
  list(query: OrganisationQuery): Observable<OrganisationPage> {
    let params = new HttpParams().set('pageindex', query.pageindex).set('pagesize', query.pagesize);
    if (query.organisationname.trim()) {
      params = params.set('organisationname', query.organisationname.trim());
    }
    return this.http
      // A 403 here is said by the screen itself (organisations are for platform staff).
      .get<{ data: OrganisationPage }>(this.url(), { params, context: new HttpContext().set(FORBIDDEN_HANDLED, true) })
      .pipe(map((r) => r.data));
  }

  /** One organisation by id (platform routes). */
  get(organisationid: string): Observable<Organisation> {
    return this.http
      .get<{ data: Organisation }>(this.url(`/${organisationid}`), {
        context: new HttpContext().set(FORBIDDEN_HANDLED, true),
      })
      .pipe(map((r) => r.data));
  }

  create(body: OrganisationCreate): Observable<Organisation> {
    return this.http
      .post<{ data: Organisation }>(this.url(), body, {
        context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
      })
      .pipe(map((r) => r.data));
  }

  update(organisationid: string, body: OrganisationWrite): Observable<Organisation> {
    return this.http
      .put<{ data: Organisation }>(this.url(`/${organisationid}`), body, {
        context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
      })
      .pipe(map((r) => r.data));
  }

  delete(organisationid: string): Observable<unknown> {
    return this.http.delete(this.url(`/${organisationid}`), {
      // A 404 is said by the list ("It no longer exists."), a 403 too.
      context: new HttpContext().set(FORBIDDEN_HANDLED, true).set(NOT_FOUND_HANDLED, true),
    });
  }

  /** The platform's countries, for the multi-select. */
  countries(): Observable<Country[]> {
    return this.http
      .get<{ data: Country[] }>(`${this.core.CORE_API()}country/all?country=`)
      .pipe(map((r) => r.data));
  }
}
