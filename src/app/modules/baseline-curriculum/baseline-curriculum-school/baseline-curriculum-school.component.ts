import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { first } from 'rxjs/operators';
import { BaseCurriculumService } from 'src/app/services/base-curriculum.service';
import { SchoolService } from 'src/app/services/school.service';
import { parse } from 'date-fns';

@Component({
  selector: 'app-baseline-curriculum-school',
  templateUrl: './baseline-curriculum-school.component.html',
  styleUrls: ['./baseline-curriculum-school.component.less']
})
export class BaselineCurriculumSchoolComponent implements OnInit {
  baselineSchoolid: any;
  dataloading: boolean = false;
  allschool: any[] = [];
  baselinetype = [
    {name: 'Baseline', value: 1},
    {name: 'Midline', value: 2},
    {name: 'Endline', value: 3}
  ];

  constructor(
    private router: Router,
    private readonly notification: NzNotificationService,
    private route: ActivatedRoute,
    private dts: BaseCurriculumService,
  ) { }

  ngOnInit(): void {
    this.dataloading = true;
    const curriculumbaselineid = this.route.snapshot.paramMap.get('curriculumbaselineid') ?? '';
    if ((curriculumbaselineid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['baseline-curriculum/index']);
      return;
    }

    this.dts.getschoolcurriculumbaseline(curriculumbaselineid)
    .pipe(first())
    .subscribe(
      (data: any) => {
        this.baselineSchoolid = data.data;
      },
      (error) => {
        if(error){
          this.dataloading = false;
        }
      },
      () => {
        this.dataloading = false;
      }
    );

  }

}
