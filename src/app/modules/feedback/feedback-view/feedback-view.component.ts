import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzImageService } from 'ng-zorro-antd/image';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { FeedbackData, IFeedbackImage, IFeedbackImagesSrc } from 'src/app/models/feedback.model';
import { FeedbackService } from 'src/app/services/feedback.service';
import { UtilService } from 'src/app/services/util.service';
import { environment } from "./../../../../environments/environment";

@Component({
  selector: 'app-feedback-view',
  templateUrl: './feedback-view.component.html',
  styleUrls: ['./feedback-view.component.less'],
})
export class FeedbackViewComponent implements OnInit {
  dataloading = false;
  errorType = [1, 2, 3, 4, 5]
  App = [
    { label: 'The App is missing in the tablet.',value: 1,checked: false },
    { label: 'The App is not working at some stage.',value: 2,checked: false },
  ]
  Raspberry = [
    { label: 'The red light is not blink',value: 1,checked: false },
    { label: 'The yellow light is not on',value: 2,checked: false },
    { label: 'The green light is not on',value: 3,checked: false },
    { label: 'The Raspberry Pi is broken',value: 4,checked: false }
  ];
  Router = [
    { label: 'The light are not on',value: 1,checked: false },
    { label: 'The cable is damaged',value: 2,checked: false },
  ]
  Tablet = [
    { label: 'The battery is not charging.',value: 1,checked: false },
    { label: 'The on and off key is damaged or broken.',value: 2,checked: false },
    { label: 'The touch screen is not working.',value: 3,checked: false },
    { label: 'The tablet is broken.',value: 4,checked: false }
  ]
  Content = [
    { label: 'The image or text overlapping with the other.',value: 1,checked: false },
    { label: 'Spelling mistake.',value: 2,checked: false },
    { label: 'Not moving to the next question.',value: 3,checked: false },
    { label: 'The audio file is not working.',value: 4,checked: false },
    { label: 'The video file is not working.',value: 5,checked: false },
    { label: 'Sound is not working in video.',value: 6,checked: false },
    { label: 'The image missing.',value: 7,checked: false },
  ]
  General = [
    { label: 'The image or text overlapping.',value: 1,checked: false },
  ];
  defaultfeedbackcontent = {
    feedback: '',
    selected_error: [],
    images: []
  }
  feedback: FeedbackData = {
    rpi: this.defaultfeedbackcontent,
    router: this.defaultfeedbackcontent,
    tablet: this.defaultfeedbackcontent,
    content: this.defaultfeedbackcontent,
    app: this.defaultfeedbackcontent,
    general: this.defaultfeedbackcontent,
  };
  feedbackImages: IFeedbackImagesSrc = {
    rpi: [],
    router: [],
    tablet: [],
    content: [],
    app: [],
    general: [],
  }
  checkGeneral: boolean = false;
  constructor(
    private dts: FeedbackService,
    private router: Router,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private route: ActivatedRoute,
    private nzImageService: NzImageService,
  ) {}

  // eslint-disable-next-line @angular-eslint/no-empty-lifecycle-method
  ngOnInit(): void {
    this.dataloading = true;
    const feedbackid = this.route.snapshot.paramMap.get('feedbackid') ?? '';
    if ((feedbackid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['feedback/index']);
      return;
    }
    this.dts
      .get(feedbackid)
      .pipe(first())
      .subscribe((tempdata: any) => {
        if (tempdata.error) {
          this.notification.create('error', 'error', 'Invalid link');
          this.router.navigate(['feedback/index']);
        }
        this.feedback = tempdata.data.feedback;
        console.log(this.feedback.general);
        this.fillCheckBox();
        this.fillImages();
      },
      (error) => {
        if(error) {
          this.dataloading = false;
        }
      },
      () => {
          this.dataloading = false;
      });
  }

  onClick(type: number): void {
    let images: Array<IFeedbackImage> = [];
    switch (type) {
      case this.errorType[0]:
        images.push(...this.feedbackImages.rpi);
        break;
      case this.errorType[1]:
        images.push(...this.feedbackImages.router);
        break;
      case this.errorType[2]:
        images.push(...this.feedbackImages.tablet);
        break;
      case this.errorType[3]:
        images.push(...this.feedbackImages.content);
        break;
      case this.errorType[4]:
        images.push(...this.feedbackImages.app);
        break;
      case this.errorType[5]:
        images.push(...this.feedbackImages.general);
        break;

      default:
        break;
    }
    this.nzImageService.preview(images, { nzZoom: 1, nzRotate: 0 });
  }

  fillCheckBox() {
    this.Raspberry = this.Raspberry.map(op => {
      if(this.feedback.rpi?.selected_error.length > 0 && this.feedback.rpi?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
    this.Router = this.Router.map(op => {
      if(this.feedback.router?.selected_error.length > 0 && this.feedback.router?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
    this.Tablet = this.Tablet.map(op => {
      if(this.feedback.tablet?.selected_error.length > 0 && this.feedback.tablet?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
    this.Content = this.Content.map(op => {
      if(this.feedback.content?.selected_error.length > 0 && this.feedback.content?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
    this.App = this.App.map(op => {
      if(this.feedback.app?.selected_error.length > 0 && this.feedback.app?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
    this.General = this.General.map(op => {
      if(this.feedback.general?.selected_error.length > 0 && this.feedback.general?.selected_error.find(v => v === op.value)) op.checked = true;
      return op
    });
  }

  fillImages() {
    this.feedbackImages.rpi = this.feedback.rpi?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
    this.feedbackImages.router = this.feedback.router?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
    this.feedbackImages.tablet = this.feedback.tablet?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
    this.feedbackImages.content = this.feedback.content?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
    this.feedbackImages.app = this.feedback.app?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
    this.feedbackImages.general = this.feedback.general?.images.map(img => {
      const image: IFeedbackImage = {
        src: `${environment.s3Link}/feedback/${img}`
      }
      return image
    });
  }

  feedbackValidation(feedback: string){
    let check: boolean;
    if(feedback.trim() !== ''){
      check = true
    }else{
      check = false
    }
    return check;
  }

  errorFeedback(feedbackValue: boolean){
    let error;
    if(feedbackValue === true){
      error = 'color: #F00000; font-weight: bold';
    }
    return error;
  }
}
