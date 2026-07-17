import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-country-create',
    templateUrl: './country-create.component.html',
    styleUrls: ['./country-create.component.less'],
    standalone: false
})
export class CountryCreateComponent implements OnInit {
  dataloading = false;
  createForm!: UntypedFormGroup;
  async submitcreateForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.dts
        .create(
          this.createForm.getRawValue()['countryname'],
          this.createForm.getRawValue()['expectedusage'],
        )
        .pipe(first())
        .toPromise();
      setTimeout(() => {
        this.notification.create(
          'success',
          'Success',
          'Country created sucessfully'
        );
      }, 400);
      this.router.navigate(['country/index']);
    }
  }
  constructor(
    private fb: UntypedFormBuilder,
    private dts: CountryService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService
  ) {}

  ngOnInit(): void {
    this.dataloading = true
    this.createForm = this.fb.group({
      countryname: [null, [Validators.required]],
      expectedusage: [null, [Validators.required]],
    });
    setTimeout(() => {
      this.dataloading = false;
    }, 400);
  }
}
