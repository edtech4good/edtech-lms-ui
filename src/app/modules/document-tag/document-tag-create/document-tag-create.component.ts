import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, first } from 'rxjs/operators';
import { DocumentTagService } from 'src/app/services/document-tag.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-document-tag-create',
    templateUrl: './document-tag-create.component.html',
    styleUrls: ['./document-tag-create.component.less'],
    standalone: false
})
export class DocumentTagCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      this.dts.create(
        this.createForm.getRawValue()['documenttagname']
      )
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.dataloading = false
          this.router.navigate(['documenttag/index']);
          setTimeout(() => {
            this.notification.create("success", 'Success', "Document tag created successfully");
          }, 400);
        },
        (error) => {
          this.dataloading = false;
        },
        ()=> {
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
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService
  ) { }

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      documenttagname: [null, [Validators.required]],
    });
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }
}
