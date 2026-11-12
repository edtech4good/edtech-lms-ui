import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AuthGuard } from './guards/auth-guard.service';
import { PageNotFoundComponent } from './modules/page-not-found/page-not-found.component';
import { UnAuthorizedComponent } from './modules/un-authorized/un-authorized.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth',
    pathMatch: 'full',
  },
  {
    path: 'auth',
    loadChildren: () =>
      import('./modules/auth/auth.module').then(
        (m) => m.AuthModule
      ),
  },
  {
    path: 'page-not-found',
    component: PageNotFoundComponent
  },
  {
    path: 'un-authorized',
    component: UnAuthorizedComponent
  },
  {
    // The public certificate check: outside the authenticated shell and its guards.
    path: 'v',
    loadComponent: () => import('./modules/certificate/certificate-check.component').then((m) => m.CertificateCheckComponent),
  },
  {
    path: 'v/:shortcode',
    loadComponent: () => import('./modules/certificate/certificate-check.component').then((m) => m.CertificateCheckComponent),
  },
  {
    // The printable page of a valid certificate: public too (it asks only the public check).
    path: 'v/:shortcode/certificate',
    loadComponent: () => import('./modules/certificate/certificate-public-print.component').then((m) => m.CertificatePublicPrintComponent),
  },
  {
    path: '',
    loadChildren: () =>
      import('./modules/commoncontainer.module').then(
        (m) => m.CommonContainer
      ), canActivate: [AuthGuard],
  },
  { path: '**', component: PageNotFoundComponent }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
