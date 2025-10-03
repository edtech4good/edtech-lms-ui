import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as csv from 'csvtojson';
import { uniq } from 'lodash';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { Observable, of } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { IFilter } from 'src/app/models/IPaging';
import { TeacherImport } from 'src/app/models/teacherimport';
import { CoreService } from 'src/app/services/core.service';
import { SchoolService } from 'src/app/services/school.service';
import { TeacherService } from 'src/app/services/teacher.service';
import { UtilService } from 'src/app/services/util.service';
import { uploadTeachersValidationSchema } from 'src/app/services/validator.service';
@Component({
  selector: 'app-teacher-index',
  templateUrl: './teacher-index.component.html',
  styleUrls: ['./teacher-index.component.less'],
})
export class TeacherIndexComponent implements OnInit {
  school$?: Observable<any>;
  uploadForm!: FormGroup;

  showUpload: boolean = false;
  data: Array<any> = [];
  fileList: NzUploadFile[] = [];
  dataLoading: boolean = true;
  currentSearch: string = 'schoolname';
  searchData: {
    [key: string]: {
      value: string;
      visible: boolean;
    };
  } = {
    schoolname: {
      value: '',
      visible: false,
    },
    schoolusername: {
      value: '',
      visible: false,
    },
  };

  total = 1;
  pageSize = 100;
  pageIndex = 1;
  filter: Array<IFilter> = [];
  constructor(
    private fb: FormBuilder,
    private teacherService: TeacherService,
    private utilService: UtilService,
    private readonly notification: NzNotificationService,
    private readonly coreService: CoreService,
    private readonly schoolService: SchoolService
  ) {}
  ngOnInit() {
    this.school$ = this.schoolService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => x.data.data)
    );
    this.school$.subscribe();

    this.resetForm();
  }
  resetForm = () => {
    this.uploadForm = this.fb.group({
      schoolname: [null, [Validators.required]],
    });
  };
  async search() {
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  }
  showuploadTeachers = () => {
    this.showUpload = true;
  };
  closeUpload = () => {
    this.showUpload = false;
  };

  sampleFile = () => `${this.coreService.CORE_API()}assets/teacher-upload.csv`;

  searchVisiblity = (event: boolean, column: string) => {
    if (event) {
      this.currentSearch = column;
    } else {
      this.currentSearch = '';
    }
    this.searchData[column].visible = event;
  };

  reset = async () => {
    this.searchData[this.currentSearch].value = '';
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  };

  async loadDataFromServer() {
    this.dataLoading = true;
    this.teacherService
      .getall({
        pagesize: this.pageSize,
        pageindex: this.pageIndex,
        filter: Object.entries(this.searchData)
          .filter(
            (
              x: [
                string,
                {
                  value: string;
                  visible: boolean;
                }
              ]
            ) => x[1].value.trim().length > 0
          )
          .map(
            (
              x: [
                string,
                {
                  value: string;
                  visible: boolean;
                }
              ]
            ) => ({ key: x[0], value: x[1].value })
          ),
      })
      .pipe(
        first(),
        catchError((x) => {
          this.dataLoading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        this.total = x.data.total;
        this.data = x.data.data;
      },
      (error) => {
        if(error) {
          this.dataLoading = false;
        }
      },
      () => {
        setTimeout(() => {
          this.dataLoading = false;
        }, 400);
      });
  }

  async onQueryParamsChange(params: NzTableQueryParams) {
    const { pageSize, pageIndex, filter } = params;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
    await this.loadDataFromServer();
  }

  handleChange = async (info: NzUploadChangeParam) => {
    if (info.type === 'start') {
      this.utilService.checkFormDirty(this.uploadForm);
      if (!this.uploadForm.valid) {
        this.fileList = [];
        return;
      }
      try {
        const file = await this.utilService.readFileContent(
          info.file.originFileObj
        );
        const data: Array<TeacherImport> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadTeachersValidationSchema,
          data,
          {
            abortEarly: false,
          }
        );
        if (validate) {
          this.notification.create('error', 'Error', validate);
          return;
        }
        if (uniq(data.map((x) => x.schoolusername)).length != data.length) {
          this.notification.create(
            'error',
            'Error',
            'Duplicate teacher name not allowed'
          );
          return;
        }
        this.teacherService
          .uploadTeacher({
            teachers: data,
            schoolname: this.uploadForm.getRawValue()['schoolname'],
          })
          .pipe(
            first(),
            catchError(async () => {
              this.resetForm();
              this.closeUpload();
              return null;
            })
          )
          .subscribe(async (x) => {
            this.fileList = [];
            if (!x) {
              return;
            }
            this.notification.create(
              'success',
              'Success',
              'Teachers uploaded successfully'
            );
            this.resetForm();
            this.closeUpload();
            await this.loadDataFromServer();
            return;
          });
      } catch {
        alert('invalid file');
      }
    }
  };

  deleteTeacher = async (schooluserid: string) => {
    await this.teacherService
      .deleteTeacher(schooluserid)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
    this.notification.create(
      'success',
      'Success',
      'Teacher deleted sucessfully'
    );
  };
}
