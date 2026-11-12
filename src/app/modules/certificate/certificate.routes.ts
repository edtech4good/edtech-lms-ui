import { Routes } from '@angular/router';
import { AuthGuard } from 'src/app/guards/auth-guard.service';
import { requirePermission } from 'src/app/guards/permission.guard';
import { LIST_CERTIFICATE } from './certificate';

/** The staff side: the Certificates page and a certificate's print page. Both need list_certificate. */
export const CERTIFICATE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./certificates-page.component').then((m) => m.CertificatesPageComponent),
    canActivate: [AuthGuard, requirePermission(LIST_CERTIFICATE)],
  },
  {
    path: ':certificateid/print',
    loadComponent: () => import('./certificate-print.component').then((m) => m.CertificatePrintComponent),
    canActivate: [AuthGuard, requirePermission(LIST_CERTIFICATE)],
    data: { crumb: 'Print' },
  },
];
