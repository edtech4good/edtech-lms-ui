import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { IMultiFilter } from 'src/app/models/IPaging';
import { StandardService } from 'src/app/services/standard.service';
import { UtilService } from 'src/app/services/util.service';
import { SchoolService } from '../../../services/school.service';

@Component({
  selector: 'app-standard-create',
  templateUrl: './standard-create.component.html',
  styleUrls: ['./standard-create.component.less'],
})
export class StandardCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  school$?: Observable<any>;
  standard: any;
  filter: Array<IMultiFilter> = [
    { key: 'standardname', value: ""},
    { key: 'schoolid', value: ""},
  ];

  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['standardname'],
          this.createForm.getRawValue()['schoolid'],
        )
        .pipe(first())
        .toPromise();
      setTimeout(() => {
        this.notification.create(
          'success',
          'Success',
          'Standard created successfully'
        );
      }, 400);
      this.router.navigate(['standard/index']);
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: StandardService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private schoolService:SchoolService
  ) {}

  ngOnInit(): void {
    this.dataloading = true
    this.createForm = this.fb.group({
      standardname: ['', [Validators.required]],
      schoolid: ['', [Validators.required]]
    });

    this.school$ = this.schoolService.getall({pagesize: 200}).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.school$.subscribe();
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }

  restrictSpecialCharecter(){
    const standardname = this.createForm.get('standardname')?.value;
    var format = /[`!@#$%^&*()_+\=\[\]{};':"\\|,.<>\/?~]/;
    // console.log('sc name is',standardname)
    if(format.test(standardname)){
      this.notification.create(
        'warning',
        'warning',
        'Special characters are not allowed'
      );
      return;
    }
  }
}
