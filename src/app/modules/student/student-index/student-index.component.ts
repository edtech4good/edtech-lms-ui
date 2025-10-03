import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as csv from 'csvtojson';
import { uniq } from 'lodash';
import { NzOptionSelectionChange } from 'ng-zorro-antd/auto-complete';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { BehaviorSubject, Observable, of, Subscription } from 'rxjs';
import { catchError, debounceTime, filter, first, map, switchMap } from 'rxjs/operators';
import { IFilter } from 'src/app/models/IPaging';
import { StudentImport, StudentImportForEdit } from 'src/app/models/studentimport';
import { CoreService } from 'src/app/services/core.service';
import { CurriculumService } from 'src/app/services/curriculum.service';
import { SchoolService } from 'src/app/services/school.service';
import { StandardService } from 'src/app/services/standard.service';
import { StudentService } from 'src/app/services/student.service';
import { UtilService } from 'src/app/services/util.service';
import { uploadEditedStudentsValidationSchema, uploadStudentsValidationSchema } from 'src/app/services/validator.service';
import saveAs from 'file-saver';
import { CountryService } from 'src/app/services/country.service';

@Component({
  selector: 'app-student-index',
  templateUrl: './student-index.component.html',
  styleUrls: ['./student-index.component.less'],
})
export class StudentIndexComponent implements OnInit {
  curriculum$?: Observable<any>;
  school$?: Observable<any>;
  standard$?: Observable<any>;
  uploadForm!: FormGroup;

  selectStandard: boolean = true;
  showUpload: boolean = false;
  selectedSchool: boolean = true;
  data: Array<any> = [];
  fileList: NzUploadFile[] = [];
  dataLoading: boolean = true;
  currentSearch: string = 'studentfirstname';
  searchData: {
    [key: string]: {
      value: string;
      visible: boolean;
    };
  } = {
    studentfirstname: {
      value: '',
      visible: false,
    },
    schoolname: {
      value: '',
      visible: false,
    },
    standard: {
      value: '',
      visible: false,
    },
    country: {
      value: '',
      visible: false,
    },
    'schooluser.schoolusername': {
      value: '',
      visible: false,
    },
    'curriculum.curriculumname': {
      value: '',
      visible: false,
    },
  };

  total = 1;
  pageSize = 100;
  pageIndex = 1;
  filter: Array<IFilter> = [];

  selectTab = 0;

  searchFields = {
    countryid: '',
    schoolname: '',
    studentid: '',
    schoolExportname: '',
  };
  // search country
  searchCountryChange$ = new BehaviorSubject({
    countryname: 'string',
  });
  countryList: any[] = [];
  isCountryLoading = false;
  // search school
  searchSchoolChange$ = new BehaviorSubject({
    schoolname: 'string',
    countryid: 'string',
  });
  schoolList: any[] = [];
  isSchoolLoading = false;
  // search user
  searchUserChange$ = new BehaviorSubject('');
  userList: any[] = [];
  isUserLoading = false;
  // search school
  searchSchoolExportChange$ = new BehaviorSubject({
    schoolname: 'string',
  });
  schoolExportList: any[] = [];
  isSchoolExportLoading = false;

  constructor(
    private fb: FormBuilder,
    private studentService: StudentService,
    private utilService: UtilService,
    private readonly notification: NzNotificationService,
    private readonly coreService: CoreService,
    private readonly schoolService: SchoolService,
    private readonly standardService: StandardService,
    private countryService: CountryService,
  ) {}
  ngOnInit() {
    this.school$ = this.schoolService.getall({ pagesize: 200 }).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => x.data.data)
    );
    this.school$.subscribe();
    this.resetForm();
    this.setupSearchCountry();
    this.setupSearchSchool();
    this.setupSearchUser();
  }
  resetForm = () => {
    this.uploadForm = this.fb.group({
      curriculumid: [null, [Validators.required]],
      schoolid: [null, [Validators.required]],
      standard: [null],
    });
  };
  async search() {
    this.searchData[this.currentSearch].visible = false;
    await this.loadDataFromServer();
  }
  showuploadStudents = () => {
    this.showUpload = true;
  };
  closeUpload = () => {
    this.showUpload = false;
  };

  sampleFile = () => `${this.coreService.CORE_API()}assets/user-upload.csv`;

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
    this.studentService
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
        this.dataLoading = false;
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
        const data: Array<StudentImport> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadStudentsValidationSchema,
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
            'Duplicate school user name not allowed'
          );
          return;
        }
        this.studentService
          .uploadStudent({
            students: data,
            curriculumid: this.uploadForm.getRawValue()['curriculumid'],
            schoolid: this.uploadForm.getRawValue()['schoolid'],
            standard: this.uploadForm.getRawValue()['standard'],
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
              'Users uploaded successfully'
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

  deletestudent = async (schooluserid: string) => {
    await this.studentService
      .deleteStudent(schooluserid)
      .pipe(first())
      .toPromise();
    await this.loadDataFromServer();
    this.notification.create(
      'success',
      'Success',
      'Student deleted sucessfully'
    );
  };

  onSelected(schoolid: any){
    this.selectedSchool = false;
    this.curriculum$ = this.schoolService.getCurriculums(schoolid).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) => {
        return x.data;
      })
    );
    this.curriculum$.subscribe();

    this.standard$ = this.standardService.getSchoolidStandard(schoolid).pipe(
      catchError((x: any) => []),
      first(),
      map((x: any) =>
      {
        return x.data
      })
    );
    this.standard$.subscribe();
  }

  onSelectcurriculum() {
    this.selectStandard = false;
  }

  setupSearchCountry() {
    const countryList$: Observable<string[]> = this.searchCountryChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getCountryList));
    countryList$.subscribe((data) => {
      this.countryList = data;
      this.isCountryLoading = false;
    });
  }

  onSearchCountry(value: string): void {
    this.isCountryLoading = true;
    this.searchCountryChange$.next({
      countryname: value
    });
  }

  getCountryList = (search: {
    countryname: string;
  }): Observable<any> =>
    this.countryService
      .getAllCountries(search.countryname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchSchool() {
    const schoolList$: Observable<string[]> = this.searchSchoolChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolList));
    schoolList$.subscribe((data) => {
      this.schoolList = data;
      this.isSchoolLoading = false;
    });
    const schoolExportList$: Observable<string[]> = this.searchSchoolExportChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getSchoolExportList));
    schoolExportList$.subscribe((data) => {
      this.schoolExportList = data;
      this.isSchoolExportLoading = false;
    });
  }

  onSearchSchool(value: string): void {
    this.isSchoolLoading = true;
    this.searchSchoolChange$.next({
      schoolname: value,
      countryid: this.searchFields.countryid ?? '',
    });
  }

  onSearchExportSchool(value: string): void {
    this.isSchoolExportLoading = true;
    this.searchSchoolExportChange$.next({
      schoolname: value,
    });
  }

  getSchoolList = (search: {
    schoolname: string;
    countryid: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname, search.countryid)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );
  
  getSchoolExportList = (search: {
    schoolname: string;
  }): Observable<any> =>
    this.schoolService
      .getAllSchools(search.schoolname)
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  setupSearchUser() {
    const userList$: Observable<string[]> = this.searchUserChange$
      .asObservable()
      .pipe(debounceTime(500))
      .pipe(switchMap(this.getUserList));
    userList$.subscribe((data) => {
      this.userList = data;
      this.isUserLoading = false;
    });
  }

  onSearchUser(value: string): void {
    this.isUserLoading = true;
    this.searchUserChange$.next(value);
  }

  getUserList = (userid: string = ''): Observable<any> =>
    this.studentService
      .getAllUsers(userid, '', '', 'true')
      .pipe(
        catchError(() => of({ results: [] })),
        map((res: any) => res.data)
      )
      .pipe(
        map((list: any) => {
          return list;
        })
      );

  handleDownload(file: NzUploadFile) {
    console.log(file);
  }

  downloading = false;
  downloadStudent() {
    this.cleanBody(this.searchFields);
    if(!this.searchFields.countryid && !this.searchFields.schoolname && !this.searchFields.studentid) {
      this.notification.create(
        'error',
        'Failed',
        'Please select a country or a school or a student before download!'
      );
      return;
    }
    this.downloading = true;
    return this.studentService.downloadStudent(this.searchFields.countryid, this.searchFields.schoolname, this.searchFields.studentid)
      .pipe(
        first(),
        catchError((x) => {
          this.downloading = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        let name = '';
        if(this.searchFields.countryid) name = this.countryList.find(ct => ct.countryid == this.searchFields.countryid)?.countryname;
        if(this.searchFields.schoolname) name = this.searchFields.schoolname;
        if(this.searchFields.studentid) name = this.searchFields.studentid;
        saveAs(x as Blob, `students-${name}.csv`);
        this.downloading = false;
      });
  }

  downloadingExport = false;
  exportStudents() {
    if(this.searchFields.schoolExportname == null) this.searchFields.schoolExportname = '';
    if(!this.searchFields.schoolExportname) {
      this.notification.create(
        'error',
        'Failed',
        'Please select a school before download the export!'
      );
      return;
    }
    this.downloadingExport = true;
    return this.studentService.exportStudents(this.searchFields.schoolExportname)
      .pipe(
        first(),
        catchError((x) => {
          this.downloadingExport = false;
          return x;
        })
      )
      .subscribe((x: any) => {
        const name =  this.searchFields.schoolExportname;
        saveAs(x as Blob, `students-${name}.zip`);
        this.downloadingExport = false;
      });
  }

  handleUpdateStudents = async (info: NzUploadChangeParam) => {
    if (info.type === 'start') {
      try {
        const file = await this.utilService.readFileContent(
          info.file.originFileObj
        );
        const data: Array<StudentImportForEdit> = await csv().fromString(file!);
        const validate = this.utilService.validate(
          uploadEditedStudentsValidationSchema,
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
            'Duplicate school user name not allowed'
          );
          return;
        }
        this.studentService
          .uploadEditedStudent({
            students: data,
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
              'Edited Students uploaded successfully'
            );
            await this.loadDataFromServer();
            location.reload();
            return;
          });
      } catch {
        alert('invalid file');
      }
    }
  };

  cleanBody = (body: any) => {
    for (const key in body) {
      if (Object.prototype.hasOwnProperty.call(body, key)) {
        if(body[key] == null) body[key] = '';
      }
    }
  }
}
