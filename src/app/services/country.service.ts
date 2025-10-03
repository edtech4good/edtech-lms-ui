import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root',
})
export class CountryService {
  constructor(
    private readonly http: HttpClient,
    private readonly coreService: CoreService
  ) {}
  getall(paging: IPaging) {
    return this.http.post(
      `${this.coreService.CORE_API()}country`,
      paging,
      this.coreService.jsonhttpOptions
    );
  }

  delete(countryid: string) {
    return this.http.delete(
      `${this.coreService.CORE_API()}country/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }

  update(country: any) {
    return this.http.put(
      `${this.coreService.CORE_API()}country/${country.countryid}`,
      {
        countryname: country.countryname,
        expectedusage: country.expectedusage,
      },
      this.coreService.jsonhttpOptions
    );
  }
  create(countryname: string, expectedusage: number) {
    return this.http.post(
      `${this.coreService.CORE_API()}country/create`,
      {
        countryname,
        expectedusage,
      },
      this.coreService.jsonhttpOptions
    );
  }
  get(countryid: string) {
    return this.http.get(
      `${this.coreService.CORE_API()}country/${countryid}`,
      this.coreService.jsonhttpOptions
    );
  }
  getAllCountries(countryname: string = '') {
    return this.http.get(
      `${this.coreService.CORE_API()}country/all?country=${countryname}`,
      this.coreService.jsonhttpOptions
    );
  }
}
