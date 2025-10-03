import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzFormatEmitEvent, NzTreeNode } from 'ng-zorro-antd/tree';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
  selector: 'app-map-index',
  templateUrl: './map-index.component.html',
  styleUrls: ['./map-index.component.less'],
})
export class MapIndexComponent implements OnInit {
  dataloading = false
  nodes: Array<any> = [];
  constructor(
    private cts: CurriculumService,
    private router: Router,
    private readonly _utilService: UtilService
  ) {}

  reroute = (event: NzFormatEmitEvent) => {
    if (event.node?.origin?.data?.type) {
      sessionStorage.setItem('JqGJMqfgE9HEU6hC', JSON.stringify(this.nodes));
      switch (event.node?.origin.data.type) {
        case 'QUIZ':
          this.router.navigate([
            `lesson/quiz/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'CURRICULUM':
          this.router.navigate([
            `curriculum/update/${event.node?.origin.data.curriculumid}`,
          ]);
          break;
        case 'GRADE':
          this.router.navigate([
            `grade/update/${event.node?.origin.data.gradeid}`,
          ]);
          break;
        case 'LEVEL':
          this.router.navigate([
            `level/update/${event.node?.origin.data.levelid}`,
          ]);
          break;
        case 'LESSON':
          this.router.navigate([
            `lesson/update/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'QUIZQUESTION':
          this.router.navigate([
            `lesson/quiz/question/${event.node?.origin.data.lessonquizid}`,
          ]);
          break;
        case 'PRACTICEQUESTION':
          this.router.navigate([
            `lesson/practice/question/${event.node?.origin.data.lessonpracticeid}`,
          ]);
          break;
        case 'LEARNING':
          this.router.navigate([
            `lesson/learning/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        case 'PRACTICE':
          this.router.navigate([
            `lesson/practice/${event.node?.origin.data.lessonid}`,
          ]);
          break;
        default:
          break;
      }
    }
    event.event?.stopPropagation();
  };
  async ngOnInit() {
    const storagedata = sessionStorage.getItem('JqGJMqfgE9HEU6hC');
    if (storagedata) {
      this.nodes = JSON.parse(storagedata);
      return;
    }
    const data: any = await this.cts.tree().toPromise();
    this.nodes = this._utilService.converttotree(data.data);
  }
  nzEvent(event: NzFormatEmitEvent): void {}
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
