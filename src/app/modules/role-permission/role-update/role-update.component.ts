import { Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzTreeNodeOptions, NzTreeNode, NzFormatEmitEvent } from 'ng-zorro-antd/tree';
import { Observable } from 'rxjs';
import { catchError, first, map } from 'rxjs/operators';
import { CountryService } from 'src/app/services/country.service';
import { RolePermService } from 'src/app/services/role-permission.service';
import { UtilService } from 'src/app/services/util.service';

@Component({
    selector: 'app-role-update',
    templateUrl: './role-update.component.html',
    styleUrls: ['./role-update.component.less'],
    standalone: false
})
export class RoleUpdateComponent implements OnInit {
  dataloading = false;
  role: any;
  permissions: any = [];
  editForm!: UntypedFormGroup;
  nodes$?: Observable<NzTreeNodeOptions[] | NzTreeNode[]>;
  nodes: NzTreeNodeOptions[] | NzTreeNode[] = [];
  defaultCheckedKeys: [] = [];
  constructor(
    private fb: UntypedFormBuilder,
    private readonly rolepermService: RolePermService,
    private readonly notification: NzNotificationService,
    private utilservice: UtilService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}
  ngOnInit(): void {
    this.dataloading = true;
    this.editForm = this.fb.group({
      permissions: [[]],
      rolename: [null, [Validators.required]],
    });
    const roleid = this.route.snapshot.paramMap.get('roleid') ?? '';
    if ((roleid || '').trim().length <= 0) {
      this.notification.create('error', 'error', 'Invalid link');
      this.router.navigate(['role-perm/index']);
      return;
    }
    this.nodes$ = this.rolepermService.getpermNodes().pipe(
      catchError((x: any) => []),
      first(),
      map((x) => {
        this.rolepermService
        .get(roleid)
        .pipe(first())
        .subscribe((tempdata: any) => {
          if (tempdata.error) {
            this.notification.create('error', 'error', 'Invalid link');
            this.router.navigate(['role-perm/index']);
          }
          this.defaultCheckedKeys = tempdata.data.selectedPerms;
          this.role = tempdata.data.role;
          this.editForm
            .get('rolename')
            ?.setValue(this.role?.rolename ?? '');
          this.editForm
            .get('permissions')
            ?.setValue(this.defaultCheckedKeys ?? []);
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
        return x.data
      })
    );
    this.nodes$.subscribe(nodes => this.nodes = nodes);
    
  }
  nzEvent(event: NzFormatEmitEvent): void {
    this.permissions = event.checkedKeys?.map(val => val.key);
    if(this.permissions){
      this.editForm.get('permissions')?.setValue(this.permissions);
    }
  }
  log(val: any): void {
    console.log(val)
  }
  async submitForm() {
    this.utilservice.checkFormDirty(this.editForm);
    if (this.editForm.valid) {
      await this.rolepermService
        .update({
          roleid: this.role.roleid ?? null,
          rolename: this.editForm.getRawValue()['rolename'] ?? null,
          permissions: this.editForm.getRawValue()['permissions'] ?? []
        }
        )
        .pipe(first())
        .toPromise();
      this.notification.create(
        'success',
        'Success',
        'Role updated successfully'
      );
      this.router.navigate(['role-perm/index']);
    }
  }
}
