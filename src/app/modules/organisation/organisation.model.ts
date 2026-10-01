/** What the organisation routes return (edtech-lms-api, src/modules/organisation/models). */

export type OrganisationPreset = 'company' | 'schoolnetwork';

export interface OrganisationCountry {
  countryid: string;
  countryname: string;
}

export interface OrganisationBranding {
  logourl?: string;
  displayname?: string;
  tilecolour?: string;
}

export interface Organisation {
  organisationid: string;
  organisationname: string;
  organisationcode: string;
  organisationshortname: string;
  organisationpreset: OrganisationPreset;
  /** false means suspended. */
  organisationstatus: boolean;
  uitheme: string;
  brandingconfig: OrganisationBranding | null;
  countries: OrganisationCountry[];
}

export interface OrganisationPage {
  data: Organisation[];
  total: number;
  pageindex: number;
  pagesize: number;
}

export interface OrganisationQuery {
  /** 1-based. */
  pageindex: number;
  /** At most 200. */
  pagesize: number;
  /** Name contains this text. */
  organisationname: string;
}

export interface OrganisationWrite {
  organisationname: string;
  organisationshortname: string;
  brandingconfig?: OrganisationBranding | null;
  organisationstatus?: boolean;
  countryids: string[];
}

export interface OrganisationCreate extends OrganisationWrite {
  organisationcode: string;
  organisationpreset: OrganisationPreset;
}

export interface Country {
  countryid: string;
  countryname: string;
}

/** The API's error body (docs/api-errors.md). A 409 carries no `fields`. */
export interface ApiErrorBody {
  code?: string;
  errormessage?: string;
  fields?: Array<{ field: string; message: string }>;
}
