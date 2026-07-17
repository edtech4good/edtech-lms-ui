import { Component, OnInit } from '@angular/core';
import { SchoolContributeService } from '../../../services/school-contribute.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { SchoolService } from 'src/app/services/school.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-school-update-contribute',
    templateUrl: './schoolcontribute-create.component.html',
    styleUrls: ['./schoolcontribute-create.component.less'],
    standalone: false
})
export class SchoolCreateContributeComponent implements OnInit {
  createForm!: UntypedFormGroup;
  schoolcontribute: any;
  school: any;
  dataloading = false;
  createData?: boolean;

  async createSchoolContribute() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.schoolContributerService
        .create(
          this.createForm.getRawValue()['schoolname'],
          this.createForm.getRawValue()['schoolid'],
          this.createForm.getRawValue()['countryid'],
          this.createForm.getRawValue()['expected'],
          this.createForm.getRawValue()['actual'],
        )
        .pipe(first())
        .toPromise();
          this.notification.create(
            'success',
            'Success',
            'School Contribute created successfully'
          );
          setTimeout(() => {
            this.router.navigate(['/school/schoolcontribute',this.school.schoolid]);
          }, 400);
    } else {
      if (this.createForm.get('schoolname')?.value !== null) {
        this.notification.create('error', 'error', 'Invalid Input');
      }
    }
  }

  constructor(
    private schoolContributerService: SchoolContributeService,
    private schoolService: SchoolService,
    private fb: UntypedFormBuilder,
    private route: ActivatedRoute,
    private notification: NzNotificationService,
    private router: Router,
    private utilservice: UtilService,
  )
  {}

  ngOnInit(): void {
    this.dataloading = true;
    // create school contributes
    this.createForm = this.fb.group({
      schoolname: [null, [Validators.required]],
      schoolid: [null, [Validators.required]],
      countryid: [null, [Validators.required]],
      expected: [null, [Validators.required]],
      actual: [null, [Validators.required]],
    });

    const schoolid = this.route.snapshot.paramMap.get('schoolid') ?? '';
    if ((schoolid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['school/index']);
      return;
    }

    this.schoolContributerService.getSchoolContributeById(schoolid)
    .pipe(first())
    .subscribe((tempdata: any) => {
      this.schoolcontribute = tempdata;
      this.getschool(schoolid);
    },
    (error) => {
      if (error) {
        this.dataloading = false;
      }
    },
    () => {
      setTimeout(() => {
        this.dataloading = false;
      }, 400);
    });
  }

  async getschool(schoolid: string) {
    this.schoolService.get(schoolid)
      .pipe(first())
      .subscribe((temp: any) => {
        this.school = temp.data;
        this.createForm.get('schoolname')
          ?.setValue(this.school.schoolname);
        this.createForm.get('schoolid')
          ?.setValue(this.school.schoolid);
        this.createForm.get('countryid')
          ?.setValue(this.school.countryid)
      });
  }
}
