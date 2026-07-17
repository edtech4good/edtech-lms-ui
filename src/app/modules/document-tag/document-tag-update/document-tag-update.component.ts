import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, first } from 'rxjs/operators';
import { DocumentTagService } from 'src/app/services/document-tag.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-document-tag-update',
    templateUrl: './document-tag-update.component.html',
    styleUrls: ['./document-tag-update.component.less'],
    standalone: false
})
export class DocumentTagUpdateComponent implements OnInit {
  dataloading = false;
  editForm!: UntypedFormGroup;
  documenttag: any;
  async submiteditForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid) {
      await this.dts.update({
        documenttagname: this.editForm.getRawValue()['documenttagname'],
        documenttagid: this.documenttag.documenttagid
      })
      .pipe(first())
      .subscribe(
        (tempdata) => {
          if(tempdata){
            this.router.navigate(['documenttag/index']);
            setTimeout(() => {
              this.notification.create("success", 'Success', "Document tag updated successfully");
            }, 400);
          }
        },
        (error) => {
          if(error){
            this.dataloading = false;
          }
        },
        () => {
          setTimeout(() => {
            this.dataloading = false;
          }, 400);
        }
      )
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: DocumentTagService,
    private route: ActivatedRoute,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService) { }

  ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      documenttagname: [null, [Validators.required]],
    });
    const documenttagid = this.route.snapshot.paramMap.get("documenttagid") ?? "";
    if ((documenttagid || '').trim().length <= 0) {
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['documenttag/index']);
      return;
    }
    this.dts.get(documenttagid)
    .pipe(first())
    .subscribe((tempdata: any) => {
      this.documenttag = tempdata.data;
      this.editForm.get('documenttagname')?.setValue(this.documenttag.documenttagname);
    },
    (error) => {
      this.dataloading = false;
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['documenttag/index']);
    },
    () => {
      setTimeout(() => {
        this.dataloading = false;
      }, 400);
    });
  }
}
