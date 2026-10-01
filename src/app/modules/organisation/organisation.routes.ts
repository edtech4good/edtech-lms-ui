import { Routes } from '@angular/router';

/**
 * The platform Organisations screens. The route's permission, group and crumb are
 * on the lazy-route entry in common-routing.module.ts.
 */
export const ORGANISATION_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./organisation-list.component').then((m) => m.OrganisationListComponent),
  },
];
