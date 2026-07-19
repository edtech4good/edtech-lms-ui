import { HttpClient, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map } from 'rxjs/operators';
import { IPaging } from 'src/app/models/IPaging';
import { CoreService } from 'src/app/services/core.service';

// Templates 9–17 have no renderer in the tablet app: a question saved against
// one shows the learner an error screen, with no warning to the author. Hidden
// here — the one place both authoring forms fetch the list — until renderers
// exist. Ids 1–8 are the supported set, 18–24 the working prototypes.
const UNRENDERABLE_TEMPLATE_IDS = new Set([9, 10, 11, 12, 13, 14, 15, 16, 17]);

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
    ).pipe(
      map((res: any) => ({
        ...res,
        data: (res?.data ?? []).filter(
          (t: any) => !UNRENDERABLE_TEMPLATE_IDS.has(t.templateid)
        ),
      }))
    );
  }


}
