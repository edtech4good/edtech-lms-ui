import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-schoolcontribute-update',
  templateUrl: './schoolcontribute-update.component.html',
  styleUrls: ['./schoolcontribute-update.component.less']
})
export class SchoolcontributeUpdateComponent implements OnInit {
  editForm!: FormGroup;
  school: any;
  dataloading = false;

  async submiteditForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid) {
      await this.schoolContributerService
        .updateSchoolDashboard({
          expected: this.editForm.getRawValue()['expected'],
          actual: this.editForm.getRawValue()['actual'],
          schoolcontributeid: this.school.schoolcontributeid
        })
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'SchoolContribute updated successfully'
      );
      this.router.navigate(['school/schoolcontribute', this.school.schoolid]);
    } else {
      if(this.editForm.get('expected')?.value !== null){
      this.notification.create(
        'error',
        'error',
        'Invalid Input'
      );
    }
    }
  }

  constructor(
    private schoolContributerService: SchoolContributeService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private notification: NzNotificationService,
    private router: Router,
    private utilservice: UtilService,
  ) { }

  ngOnInit(): void {
    this.dataloading = true;
    this.editForm = this.fb.group({
      expected: [null, Validators.required],
      actual: [null, Validators.required]
    })

    const schoolcontributeid = this.route.snapshot.paramMap.get('schoolcontributeid') ?? '';
    if ((schoolcontributeid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['school/index']);
      return;
    }

    this.schoolContributerService
      .getSchoolContributeId(schoolcontributeid)
      .pipe(first())
      .subscribe((temp:any) => {
        this.school = temp.data;
        this.editForm.get('expected')
          ?.setValue(this.school.expected);
        this.editForm.get('actual')
          ?.setValue(this.school.actual);
      },
      (error)=>{
        if (error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['school/schoolcontribute', this.school.schoolid]);
        }
      },
      () =>{
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
      })
  }

}
