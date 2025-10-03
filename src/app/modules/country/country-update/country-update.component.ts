import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-country-update',
  templateUrl: './country-update.component.html',
  styleUrls: ['./country-update.component.less']
})
export class CountryUpdateComponent implements OnInit {
  dataloading = false;
  valid = false;
  editForm!: FormGroup;
  country: any;
  async submiteditForm() {
    this.restrictSpecialCharecter();
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid && this.valid) {
      await this.dts
        .update({
          countryname: this.editForm.getRawValue()['countryname'],
          expectedusage: this.editForm.getRawValue()['expectedusage'],
          countryid: this.country.countryid
        })
        .pipe(first())
        .toPromise();
        setTimeout(() => {
          this.notification.create(
            'success',
            'Success',
            'Country updated successfully'
          );
        }, 400);
      this.router.navigate(['country/index']);
    } else {
      this.notification.create(
        'error',
        'Error',
        'Invalid Form'
      );
    }
  }
  constructor(
    private fb: FormBuilder,
    private dts: CountryService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.dataloading = true;
    this.editForm = this.fb.group({
      countryname: [null, [Validators.required]],
      expectedusage: [null, [Validators.required]],
    });

    const countryid = this.route.snapshot.paramMap.get('countryid') ?? '';
    if ((countryid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['country/index']);
      return;
    }
    this.dts
      .get(countryid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['country/index']);
        }
        this.country = tempdata.data;
        this.editForm
          .get('countryname')
          ?.setValue(this.country.countryname);
        this.editForm
          .get('expectedusage')
          ?.setValue(this.country.expectedusage ?? null);
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
      });
  }

  restrictSpecialCharecter() {
    const countryname = this.editForm.get('countryname')?.value;
    var format = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~]/;
    if (format.test(countryname)) {
      this.valid = false;
      this.notification.create(
        'warning',
        'warning',
        'Special characters are not allowed'
      );
      return;
    } else {
      this.valid = true;
    }
  }

}
