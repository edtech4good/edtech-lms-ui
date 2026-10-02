import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { EMPTY, Observable, expand, reduce } from 'rxjs';
import { FIELD_ERRORS_INLINE } from 'src/app/interceptors/error-context';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';
import { Organisation } from 'src/app/modules/organisation/organisation.model';
import { OrganisationService } from 'src/app/modules/organisation/organisation.service';

/** The body of POST /user/create and PUT /user/:id. */
export interface StaffWrite {
  lmsusername: string;
  lmsuserpasswordhash?: string | null;
  lmsuserroles: string[];
  countryids?: string[];
  schoolids?: string[];
  /**
   * Only a platform caller sends this (null for a platform account). Anyone else
   * leaves the key out: the API uses the caller's own organisation, and refuses a
   * request that names one.
   */
  organisationid?: string | null;
}

/** The pages of the organisation list are fetched at this size (the API's largest). */
const ORGANISATION_PAGE_SIZE = 200;

@Injectable({
  providedIn: 'root',
})
export class UserService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService,
    private readonly organisationService: OrganisationService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}user`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(userid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}user/${userid}`,
      this.coreService.jsonhttpOptions
    );
  }

  /**
   * The create and update forms say a failed save themselves (a message on the
   * field the API names, or one for the form), so the error interceptor must not
   * also toast it.
   */
  private readonly ownErrors = () => ({
    ...this.coreService.jsonhttpOptions,
    context: new HttpContext().set(FIELD_ERRORS_INLINE, true),
  });

  update(lmsuserid: string, body: StaffWrite) {
    return this.http.put(`${this.coreService.CORE_API()}user/${lmsuserid}`, body, this.ownErrors());
  }

  create(body: StaffWrite) {
    return this.http.post(`${this.coreService.CORE_API()}user/create`, body, this.ownErrors());
  }

  get(lmsuserid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}user/${lmsuserid}`,
      this.coreService.jsonhttpOptions
    );
  }

  /** Every live organisation, by name, across as many pages as there are (a platform caller's select). */
  liveOrganisations(): Observable<Organisation[]> {
    const page = (pageindex: number) =>
      this.organisationService.list({ pageindex, pagesize: ORGANISATION_PAGE_SIZE, organisationname: '' });
    return page(1).pipe(
      expand((result, i) => (result.data.length > 0 && (i + 1) * ORGANISATION_PAGE_SIZE < result.total ? page(i + 2) : EMPTY)),
      reduce((all, result) => all.concat(result.data), [] as Organisation[])
    );
  }
}
