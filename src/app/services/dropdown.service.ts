import { HttpClient, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

@Injectable({
  providedIn: 'root'
})
export class DropDownService {

  constructor(
    private http: HttpClient,
    private readonly coreService: CoreService,
  ) { }
  gettemplatetype() {
    return this.http.get(
      `${this.coreService.CORE_API()}dropdown/templatetype`,
      this.coreService.jsonhttpOptions
    );
  }


}
