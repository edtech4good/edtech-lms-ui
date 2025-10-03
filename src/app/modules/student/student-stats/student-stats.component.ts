import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NzFormatEmitEvent, NzTreeNode } from 'ng-zorro-antd/tree';
import { first } from 'rxjs/operators';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { StudentService } from 'src/app/services/student.service';
import { UtilService } from 'src/app/services/util.service';
@Component({
  selector: 'app-student-stats',
  templateUrl: './student-stats.component.html',
  styleUrls: ['./student-stats.component.less'],
})
export class StudentStatsComponent implements OnInit {
  constructor(
    private router: RouterOutlet,
    private readonly _studentservice: StudentService,
    private readonly _curriculumService: CurriculumService,
    private readonly _utilService: UtilService
  ) {}
  dataloading = false;
  studentdetails: any;
  studentlevel: Array<any> = [];
  studentquiz: Array<any> = [];
  studentpractice: Array<any> = [];
  curriculumtree: any;
  async ngOnInit() {
    this.router.activatedRoute.params.pipe(first()).subscribe((route) => {
      if (route?.studentid) {
        this._studentservice
          .getStudent(route.studentid)
          .pipe(first())
          .subscribe((student: any) => {
            this.studentdetails = student.data;
            this._curriculumService
              .curriculumtree(student.data.curriculumid)
              .pipe(first())
              .subscribe((curriculumtree: any) => {
                this.curriculumtree = this._utilService.converttotree(
                  curriculumtree.data,
                  true
                );
              });
          },
          (error) => {
            if(error) {
              this.dataloading = false;
            }
          },
          () => {
            setTimeout(() => {
              this.dataloading = false;
            }, 400);
          });

        this._studentservice
          .getStudentLevelStats(route.studentid)
          .pipe(first())
          .subscribe((studentLevelStats: any) => {
            this.studentlevel = studentLevelStats.data;
          });

        this._studentservice
          .getStudentPracticeStats(route.studentid)
          .pipe(first())
          .subscribe((studentPracticeStats: any) => {
            this.studentpractice = studentPracticeStats.data;
          });

        this._studentservice
          .getStudentQuizStats(route.studentid)
          .pipe(first())
          .subscribe((studentQuizStats: any) => {
            this.studentquiz = studentQuizStats.data;
          });
      }
    });
  }

  isPass = (id: string, type: string) => {
    switch (type) {
      case 'LEVEL':
        return this.studentlevel.find(
          (x) => x.ispass && x.studentprogressreferenceid === id
        )
          ? true
          : false;
      case 'QUIZQUESTION':
        return this.studentquiz.find(
          (x) => x.ispass && x.studentprogressreferenceid === id
        )
          ? true
          : false;
      case 'PRACTICEQUESTION':
        return this.studentpractice.find(
          (x) => x.ispass && x.studentprogressreferenceid == id
        )
          ? true
          : false;

      default:
        return null;
    }
  };

  passDate = (id: string, type: string) => {
    switch (type) {
      case 'LEVEL':
        const templevel = this.studentlevel.find(
          (x) => x.ispass && x.studentprogressreferenceid === id
        );
        console.log(templevel);

        return templevel ? templevel.starttime : false;
      case 'QUIZQUESTION':
        const tempqq = this.studentquiz.find(
          (x) => x.ispass && x.studentprogressreferenceid === id
        );
        return tempqq ? tempqq.starttime : false;
      case 'PRACTICEQUESTION':
        const temppq = this.studentpractice.find(
          (x) => x.ispass && x.studentprogressreferenceid == id
        );
        return temppq ? temppq.starttime : false;

      default:
        return null;
    }
  };

  openFolder(data: NzTreeNode | NzFormatEmitEvent): void {
    // do something if u want
    if (data instanceof NzTreeNode) {
      data.isExpanded = !data.isExpanded;
    } else {
      const node = data.node;
      if (node) {
        node.isExpanded = !node.isExpanded;
      }
    }
  }
}
