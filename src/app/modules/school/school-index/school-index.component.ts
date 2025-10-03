import { Component, OnInit } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, first, map } from 'rxjs/operators';
import { IFilter, IMultiFilter, IMultiPaging, IPaging } from 'src/app/models/IPaging';
import { CountryService } from 'src/app/services/country.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolContributeService } from 'src/app/services/school-contribute.service';
import { SchoolService } from 'src/app/services/school.service';
import { StudentService } from 'src/app/services/student.service';

@Component({
  selector: 'app-school-index',
  templateUrl: './school-index.component.html',
  styleUrls: ['./school-index.component.less'],
})
export class SchoolIndexComponent implements OnInit {
  dataloading = false;
  searchValue = '';
  total = 1;
  data: Array<any> = [];
  pageSize = 10;
  pageIndex = 1;
  filter: Array<IMultiFilter> = [
    { key: 'schoolname', value: ""},
    { key: 'countryid', value: ""},
    { key: 'curriculums', value: ""}
  ];
  visible = false;
  filterField = {
    countries: [],
    curriculums: []
  }
  async loadDataFromServer(paging: IMultiPaging) {
    this.dataloading = true;
    this.pageIndex = paging.pageindex || 1;
    this.filter = paging.filter || [];
    this.pageSize = paging.pagesize || 10;
    this.schoolService
      .getall(paging)
      .pipe(first())
      .subscribe(
        (tempdata: any) => {
          this.data = tempdata.data.data;
          this.total = tempdata.data.total;
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
        }
      )
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    // console.log(params);
    this.assignFilterNewValue(filter);
    await this.loadDataFromServer({
      filter: this.filter,
      pageindex: pageIndex,
      pagesize: pageSize,
    });
  }

  deletetag = async (schoolid: string) => {
    await this.schoolService.delete(schoolid).pipe(first()).toPromise();
    this.loadDataFromServer({
      filter: [...this.filter],
      pageindex: this.pageIndex,
      pagesize: this.pageSize,
    });
    await this.schoolContributeService.deleteSchoolContribute(schoolid).pipe(first()).toPromise();
    this.notification.create(
      'success',
      'Success',
      'School deleted sucessfully'
    );
  };

  constructor(
    private readonly schoolService: SchoolService,
    private readonly notification: NzNotificationService,
    private readonly studentService: StudentService,
    private readonly countryService: CountryService,
    private readonly curriculumService: CurriculumService,
    private readonly schoolContributeService: SchoolContributeService
  ) {}

  ngOnInit(): void {
    this.buildFilter();
  }

  async search() {
    this.visible = false;
    if (this.searchValue.length > 0) {
      await this.loadDataFromServer({
        filter: [
          ...this.filter.filter((x) => x.key !== 'schoolname'),
          ...[{ key: 'schoolname', value: this.searchValue }],
        ],
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    } else {
      await this.loadDataFromServer({
        filter: this.filter.filter((x) => x.key !== 'schoolname'),
        pageindex: this.pageIndex,
        pagesize: this.pageSize,
      });
    }
  }

  exportStudents = (schoolname: string) =>
    this.studentService
      .exportStudent(schoolname)
      .pipe(first())
      .subscribe((res: any) => {
        let url = window.URL.createObjectURL(res);
        let a = document.createElement('a');
        document.body.appendChild(a);
        a.setAttribute('style', 'display: none');
        a.href = url;
        a.download = `students-${schoolname}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      });

  synccloudStudents = (schoolname: string) =>
    this.studentService
      .synccloudStudent(schoolname)
      .pipe(first())
      .subscribe(async (_res: any) => {
        this.notification.create(
          'success',
          'Success',
          `${schoolname} students synced sucessfully`
        );
      });

  reset(): void {
    this.searchValue = '';
    this.search();
  }

  assignFilterNewValue = (filter: Array<{ key: string; value: any; }> = []) => {
    // assign schoolname
    if (this.searchValue.length > 0) {
      this.filter = this.filter.map(obj => obj.key === 'schoolname' ? { ...obj , value: this.searchValue} : obj);
    }
    // assign countryname
    if (filter.length > 0) {
      this.filter = this.filter.map(obj => {
        const field = filter.length > 0 ? filter.find(x => (x.key === obj.key)) : null;
        return field ? { ...obj , value: field.value} : obj;
      });
    }
  }

  buildFilter = async () => {
    // load all country
    this.filterField.countries = await this.countryService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((country: any) => ({
          text: country.countryname,
          value: country.countryid
        }));
      })
    ).toPromise();

    // all curriculums
    this.filterField.curriculums = await this.curriculumService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return (x.data.data).map((curriculum: any) => ({
          text: curriculum.curriculumname,
          value: curriculum.curriculumid
        }));
      })
    ).toPromise();
  }
}
