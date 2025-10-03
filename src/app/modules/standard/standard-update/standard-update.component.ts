import { Component, OnInit } from '@angular/core';
import { StandardService } from '../../../services/standard.service';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, first, map } from 'rxjs/operators';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { SchoolService } from '../../../services/school.service';
import { IMultiFilter } from 'src/app/models/IPaging';
import { any } from 'joi';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-standard-update',
  templateUrl: './standard-update.component.html',
  styleUrls: ['./standard-update.component.less']
})
export class StandardUpdateComponent implements OnInit {
  dataloading = false;
  school$?: Observable<any>;
  standard: any;
  editForm!: FormGroup;
  filter: Array<IMultiFilter> = [
    { key: 'standardname', value: ""},
    { key: 'schoolid', value: ""},
  ];

  async submiteditForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid) {
      await this.dts
        .update({
          standardname: this.editForm.getRawValue()['standardname'],
          schoolid: this.editForm.getRawValue()['schoolid'],
          standardid: this.standard.standardid
        })
        .pipe(first())
        .toPromise();
      setTimeout(() => {
        this.notification.create(
          'success',
          'Success',
          'Standard updated successfully'
        );
      }, 400);
      this.router.navigate(['standard/index']);
    } else {
      if(this.editForm.get('standardname')?.value !==null){
      this.notification.create(
        'error',
        'error',
        'Invalid Input'
      );
    }
    }
  }

  constructor(
    private dts: StandardService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private schoolService: SchoolService,
    private utilservice: UtilService
    ) { }

  ngOnInit(): void {
    this.dataloading = true;
    this.editForm = this.fb.group({
      standardname: ['',Validators.required],
      schoolid: ['',Validators.required],
    })

    this.school$ = this.schoolService.getall({pagesize: 200}).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data.data;
      })
    );
    this.school$.subscribe();

    const standardid = this.route.snapshot.paramMap.get('standardid') ?? '';
    if ((standardid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['standard/index']);
      return;
    }
    this.dts
      .get(standardid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        this.standard = tempdata.data;
        this.editForm
        .get('standardname')
          ?.setValue(this.standard.standardname);
        if(this.standard.schoolid) {
          this.editForm
            .get('schoolid')
            ?.setValue(this.standard.schoolid);
        }
      },
      (error) => {
        if (error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['standard/index']);
        }
      },
      () => {
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
      });
  }

  restrictSpecialCharecter(){
    const standardname = this.editForm.get('standardname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
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
