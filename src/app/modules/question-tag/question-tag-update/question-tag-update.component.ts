import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { QuestionTagService } from 'src/app/services/question-tag.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-question-tag-update',
    templateUrl: './question-tag-update.component.html',
    styleUrls: ['./question-tag-update.component.less'],
    standalone: false
})
export class QuestionTagUpdateComponent implements OnInit {
  dataloading = false;
  editForm!: UntypedFormGroup;
  questiontag: any;
  async submiteditForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid) {
      await this.dts.update({
        questiontagname: this.editForm.getRawValue()['questiontagname'],
        questiontagid: this.questiontag.questiontagid
      })
      .pipe(first())
      .toPromise();
      setTimeout(() => {
        this.notification.create("success", 'Success', "Question tag updated sucessfully");
      }, 400);
      this.router.navigate(['questiontag/index']);
    }
  }
  constructor(private fb: UntypedFormBuilder,
    private dts: QuestionTagService, private route: ActivatedRoute,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService) { }

  ngOnInit() {
    this.dataloading = true;
    this.editForm = this.fb.group({
      questiontagname: [null, [Validators.required]],
    });
    const questiontagid = this.route.snapshot.paramMap.get("questiontagid") ?? "";
    if ((questiontagid || '').trim().length <= 0) {
      this.notification.create("error", 'error', "Invalid link");
      this.router.navigate(['questiontag/index']);
      return;
    }
    this.dts.get(questiontagid)
    .pipe(first())
    .subscribe(
      (tempdata: any) => {
      this.questiontag = tempdata.data;
      this.editForm.get('questiontagname')?.setValue(this.questiontag.questiontagname);
    },
    (error) => {
      if(error){
        this.dataloading = false;
        this.notification.create("error", 'error', "Invalid link");
        this.router.navigate(['questiontag/index']);
      }
    },
    () => {
      setTimeout(() => {
        this.dataloading = false;
      }, 400);
    });
  }
}
