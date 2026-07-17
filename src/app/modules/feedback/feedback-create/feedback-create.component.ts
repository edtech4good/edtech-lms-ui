import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators, FormControl, FormArray } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { UtilService } from 'src/app/services/util.service';
import { first } from 'rxjs/operators';
import { Observable, pipe } from 'rxjs';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { FeedbackService } from 'src/app/services/feedback.service';

@Component({
    selector: 'app-feedback-create',
    templateUrl: './feedback-create.component.html',
    styleUrls: ['./feedback-create.component.less'],
    standalone: false
})
export class FeedbackCreateComponent implements OnInit {
  file: Array<any> = [];
  fileList: NzUploadFile[] = [];
  showUpload = true;
  createForm!: UntypedFormGroup;
  RaspberryPi = [
    { label: 'The red light is not blink.'},
    { label: 'The yellow light is not on.'},
    { label: 'The green light is not on.'},
    { label: 'The Raspberry Pi is broken.'}
    // { label: 'The red light is not blink.', checked: false},
    // { label: 'The yellow light is not on.', checked: false},
    // { label: 'The green light is not on.', checked: false},
    // { label: 'The Raspberry Pi is broken.', checked: false}
  ];

  log(value: object[]): void {
    console.log(value);
  }

  async submitcreateForm() {
    // console.log(JSON.stringify(value))
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      // await this.dts
      // // this.createForm.getRawValue()['feedback']
      //   .create(JSON.stringify(this.createForm.getRawValue()['feedback']))
      //   .pipe(first())
      //   .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Feedback created successfully'
      );
      this.router.navigate(['feedback/index']);
    }
  }


  constructor(
    private fb: UntypedFormBuilder,
    private dts: FeedbackService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService
  ) {}

  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngOnInit(): void {
    this.createForm = this.fb.group({
      feedback: [null, Validators.required],
      document: [null, [Validators.required]],
      // feedback: this.fb.group({
      //   document:this.fb.array([this.selectedFiles]),
      //   feed:['',Validators.required]
      // }),
      // raspberrypi:this.fb.array([])
      // raspberrypii: this.fb.array([]),
      // raspberrypi: this.fb.group({
      //   a: this.fb.control(false),
      //   b: this.fb.control(false),
      //   c: this.fb.control(false),
      //   d: this.fb.control(false),
      // }),
      // raspberrypiii:[this.RaspberryPi]
    });
  }
  selectedFiles?: FileList;
  progressInfos: any[] = [];
  message: string[] = [];

  previews: string[] = [];
  imageInfos?: Observable<any>;

  onChange(event: any) {
    this.message = [];
    this.progressInfos = [];
    this.selectedFiles = event.target.files;

    this.previews = [];
    if (this.selectedFiles && this.selectedFiles[0]) {
      const numberOfFiles = this.selectedFiles.length;
      for (let i = 0; i < numberOfFiles; i++) {
        const reader = new FileReader();

        reader.onload = (e: any) => {
          console.log('-----------------');
          console.log(e.target.result);
          console.log('-----------------');
          this.previews.push(e.target.result);
        };

        reader.readAsDataURL(this.selectedFiles[i]);
      }
    }
  }
}
class ImageSnippet {
  constructor(public src: string, public file: File) {}
}
