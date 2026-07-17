import { Component, HostListener, OnInit } from '@angular/core';
import { orderBy } from 'lodash';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { catchError, first, map } from 'rxjs/operators';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { LessonService } from 'src/app/services/lesson.service';

@Component({
    selector: 'app-lesson-index',
    templateUrl: './lesson-index.component.html',
    styleUrls: ['./lesson-index.component.less'],
    standalone: false
})
export class LessonIndexComponent implements OnInit {
  dataloading = false;
  filter: any = {
    levelname: {
      searchValue: [],
    },
    gradename: {
      searchValue: [],
    },
    curriculumname: {
      searchValue: [],
    },
  };

  // search function
  searchFunction = ($searchValue: any, columnKey: string) => {
    switch (columnKey) {
      case 'gradename':
        this.filter.levelname.searchValue = [];
        break;
      case 'curriculumname':
        this.filter.levelname.searchValue = [];
        this.filter.gradename.searchValue = [];
        break;
    }
    this.filter[columnKey].searchValue = $searchValue;
    this.data = this.data.map((x) => {
      let returndata = {
        ...x,
        visible: true,
      };
      try {
        if (
          this.filter.levelname.searchValue.length > 0 &&
          !this.filter.levelname.searchValue.includes(x.levelname)
        ) {
          this.visible = false;
          returndata = { ...returndata, visible: false };
        } else if (
          this.filter.gradename.searchValue.length > 0 &&
          !this.filter.gradename.searchValue.includes(x.gradename)
        ) {
          this.visible = false;
          returndata = { ...returndata, visible: false };
        } else if (
          this.filter.curriculumname.searchValue.length > 0 &&
          !this.filter.curriculumname.searchValue.includes(x.curriculumname)
        ) {
          this.visible = false;
          returndata = { ...returndata, visible: false };
        }
        return returndata;
      } catch (e) {
        return returndata;
      }
    });
    this.buildFilterList();
  };

  // delete data
  deletetag = async (lessonid: string) => {
    await this.lessonService.delete(lessonid).pipe(first()).toPromise();
    await this.fetchData();
    this.notification.create(
      'success',
      'Success',
      'Lesson deleted sucessfully'
    );
  };

  // list data
  listOfColumns: any[] = [
    {
      name: 'Curriculum',
      filterFn: (curriculumnames: [string], item: any) =>
        curriculumnames.find((ln) => ln === item.curriculumname) !== null,
      showFilter: true,
      columnKey: 'curriculumname',
      listOfFilter: [],
    },
    {
      name: 'Grade',
      filterFn: (gradenames: [string], item: any) =>
        gradenames.find((ln) => ln === item.gradename) !== null,
      showFilter: true,
      columnKey: 'gradename',
      listOfFilter: [],
    },
    {
      name: 'Level',
      filterFn: (levelnames: [string], item: any) =>
        levelnames.find((ln) => ln === item.levelname) !== null,
      showFilter: true,
      columnKey: 'levelname',
      listOfFilter: [],
    },
  ];

  // sort data
  sortFunction = (direction: string | null) => {
    this.data = orderBy(
      this.data,
      ['lessonorder'],
      [direction == 'descend' ? 'desc' : 'asc']
    );
  };

  // variable
  total = 1;
  data: Array<any> = [];
  pageSize = 100;
  pageIndex = 1;
  visible = false;
  trigger = false
  mapdata: any;

  constructor(
    private readonly notification: NzNotificationService,
    private readonly cts: CurriculumService,
    private lessonService: LessonService,
  ) {}

  // init data
  async ngOnInit() {
    this.dataloading = true;
    const lessonData = sessionStorage.getItem('lessonData') ?? '[]';
    const tempData = sessionStorage.getItem('tempData') ?? '[]';
    const filter = sessionStorage.getItem('filter') ?? '[]';

    if(this.data.length == 0 && lessonData == '[]'){
      await this.fetchData();
    }else{
      this.data = JSON.parse(lessonData);
      this.mapdata = JSON.parse(tempData);
      this.filter = JSON.parse(filter);
      this.buildFilterList();
    }

  }

  // store temporary data
  storeData(){
   sessionStorage.setItem('lessonData',JSON.stringify(this.data));
   sessionStorage.setItem('tempData',JSON.stringify(this.mapdata));
   this.data = orderBy(this.data, ['lessonorder'], ['asc']);
   sessionStorage.setItem('filter', JSON.stringify(this.filter))
  }

  // clear temporary data
  clearData(){
    sessionStorage.removeItem('lessonData');
    sessionStorage.removeItem('tempData');
    sessionStorage.removeItem('filter');
    window.location.reload()
  }

  // sync data
  fetchData = async () => {
    const tempdata: any = await this.cts
      .map()
      .pipe(
        catchError(async () => ({ data: [] })),
        map((res: any) => res.data)
      )
      .toPromise();
    this.data = tempdata.lessons.filter((lesson: any) => {
      return lesson.isdeleted === false
    }).map((lesson: any) => {
      const level = tempdata.levels.find(
        (x: any) => x.levelid === lesson.levelid
      );
      const grade = tempdata.grades.find(
        (x: any) => x.gradeid === level.gradeid
      );
      const curriculum = tempdata.curriculums.find(
        (x: any) => x.curriculumid === grade.curriculumid
      );

      return {
        ...lesson,
        levelname: level.levelname,
        gradename: grade.gradename,
        visible: true,
        curriculumname: curriculum.curriculumname,
        level,
        grade,
        curriculum,
      };
    });
    this.data = orderBy(this.data, ['lessonorder'], ['asc']);
    //const templevels = Object.fromEntries(tempdata.levels.map((x: any) => [x.levelid, x]));
    this.mapdata = tempdata;
    this.buildFilterList();
  };

  async loading(data: any){
    const tempdata = await data;
    if(tempdata.error){
      this.dataloading = false;
    }

    if(tempdata.length > 0 && tempdata !== '[]') {
      setTimeout(() => {
        this.dataloading = false;
      }, 400);
    }
  }

  //
  buildFilterList = () => {
    this.dataloading = true;
    const tempdata = this.mapdata;
    const tempcurriculums = Object.fromEntries(
      tempdata.curriculums.map((x: any) => [x.curriculumid, x])
    );
    const tempgrades = Object.fromEntries(
      tempdata.grades.map((x: any) => [x.gradeid, x])
    );

    this.listOfColumns[
      this.listOfColumns.findIndex((x) => x.columnKey === 'levelname')
    ].listOfFilter = tempdata.levels
      .map((x: any) => {
        const tempc = tempgrades[x.gradeid];
        const curriculumname =
          tempcurriculums[tempc.curriculumid].curriculumname;
        return {
          text: `${x.levelname} => ${tempc.gradename} => ${
            tempcurriculums[tempc.curriculumid].curriculumname
          }`,
          value: x.levelname,
          gradename: tempc.gradename,
          curriculumname,
          levelstatus: x.levelstatus,
          byDefault: this.filter.levelname.searchValue.includes(x.levelname),
        };
      })
      .filter((x: any) => {
        if (!x.levelstatus || x.isdeleted) {
          return false;
        }
        if (
          this.filter.curriculumname.searchValue.length > 0 &&
          !this.filter.curriculumname.searchValue.includes(x.curriculumname)
        ) {
          return false;
        }
        if (
          this.filter.gradename.searchValue.length > 0 &&
          !this.filter.gradename.searchValue.includes(x.gradename)
        ) {
          return false;
        }

        return true;
      });

    this.listOfColumns[
      this.listOfColumns.findIndex((x) => x.columnKey === 'gradename')
    ].listOfFilter = tempdata.grades
      .map((x: any) => ({
        text: `${x.gradename} => ${
          tempcurriculums[x.curriculumid].curriculumname
        }`,
        value: x.gradename,
        curriculumname: tempcurriculums[x.curriculumid].curriculumname,
        gradestatus: x.gradestatus,
        isdeleted: x.isdeleted,
        byDefault: this.filter.gradename.searchValue.includes(x.gradename),
      }))
      .filter((x: any) => {
        if (!x.gradestatus || x.isdeleted) {
          return false;
        }
        return (
          this.filter.curriculumname.searchValue.length <= 0 ||
          (this.filter.curriculumname.searchValue.length > 0 &&
            this.filter.curriculumname.searchValue.includes(x.curriculumname))
        );
      });

    this.listOfColumns[
      this.listOfColumns.findIndex((x) => x.columnKey === 'curriculumname')
    ].listOfFilter = tempdata.curriculums
      .map((x: any) => ({
        text: x.curriculumname,
        value: x.curriculumname,
        curriculumstatus: x.curriculumstatus,
        isdeleted: x.isdeleted,
        byDefault: this.filter.curriculumname.searchValue.includes(
          x.curriculumname
        ),
      }))
      .filter((x: any) => {
        setTimeout(() => {
          this.dataloading = false;
        }, 400);
        return !(!x.curriculumstatus || x.isdeleted);
      });
  };
}
