import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzFormatEmitEvent, NzTreeNode, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { Observable, pipe } from 'rxjs';
import { catchError, first, map  } from 'rxjs/operators';
import { RolePermService } from 'src/app/services/role-permission.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-role-create',
    templateUrl: './role-create.component.html',
    styleUrls: ['./role-create.component.less'],
    standalone: false
})
export class RoleCreateComponent implements OnInit {
  dataLoading = false;
  permissions: any = [];
  createForm!: UntypedFormGroup;
  nodes$?: Observable<NzTreeNodeOptions[] | NzTreeNode[]>;
  nodes: NzTreeNodeOptions[] | NzTreeNode[] = [];
  constructor(
    private fb: UntypedFormBuilder,
    private readonly rolepermService: RolePermService,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private router: Router,
  ) {}
  ngOnInit(): void {
    this.dataLoading = true;
    this.createForm = this.fb.group({
      permissions: [[]],
      rolename: [null, [Validators.required]],
    });
   this.nodes$ = this.rolepermService.getpermNodes().pipe(
      catchError((x: any) => []),
      first(),
      map((x) => {
        return x.data
      })
    );
    this.nodes$.subscribe(
    nodes => {
      this.nodes = nodes;
    },
    (error) => {
      this.notification.create(
        'error',
        'Error',
        error
      )
      setTimeout(() => {
        this.dataLoading = false;
      }, 400);
    },
    () => {
      setTimeout(() => {
        this.dataLoading = false;
      }, 400);
    });
  }
  nzEvent(event: NzFormatEmitEvent): void {
    this.permissions = event.checkedKeys?.map(val => val.key);
    if(this.permissions){
      this.createForm.get('permissions')?.setValue(this.permissions);
    }
  }
  log(val: any): void {
    console.log(val)
  }
  async submitForm() {
    this.utilservice.checkFormDirty(this.createForm);
    if (this.createForm.valid) {
      await this.rolepermService
        .create(
          this.createForm.getRawValue()['rolename'],
          this.createForm.getRawValue()['permissions'],
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Role created sucessfully'
      );
      this.router.navigate(['role-perm/index']);
    }
  }
}
