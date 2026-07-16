import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { QuestionTagService } from 'src/app/services/question-tag.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-question-tag-create',
  templateUrl: './question-tag-create.component.html',
  styleUrls: ['./question-tag-create.component.less']
})
export class QuestionTagCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.dts.create(
        this.createForm.getRawValue()['questiontagname']
      )
      .pipe(first())
      .toPromise();
      setTimeout(() => {
        this.notification.create("success", 'Success', "Question tag created sucessfully");
      }, 400);
      this.router.navigate(['questiontag/index']);
    }
  }
  constructor(private fb: UntypedFormBuilder,
    private dts: QuestionTagService,
    private router: Router, private readonly notification: NzNotificationService,
    private utilservice: UtilService) { }

  ngOnInit(): void {
    this.dataloading = true;
    this.createForm = this.fb.group({
      questiontagname: [null, [Validators.required]],
    });
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }
}
