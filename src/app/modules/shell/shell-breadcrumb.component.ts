import { Component, signal } from '@angular/core';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { ShellNavService } from './shell-nav.service';

export interface Crumb {
  label: string;
  /** Absent on the group (it has no page of its own) and on the last crumb. */
  link?: string;
}

/**
 * "Group › Page › Sub-page", read from the `data` on the route configs that
 * lead to the current page:
 *   group      the menu group's name; set once, on the lazy-module route
 *   crumb      this level's name
 *   crumbLink  where this level's list page lives (used when a deeper level follows)
 * The last crumb is plain bold text; the others link to their list page.
 */
@Component({
  selector: 'app-shell-breadcrumb',
  standalone: false,
  templateUrl: './shell-breadcrumb.component.html',
  styleUrls: ['./shell-breadcrumb.component.less'],
})
export class ShellBreadcrumbComponent {
  readonly crumbs = signal<Crumb[]>([]);

  constructor(
    private readonly router: Router,
    private readonly nav: ShellNavService,
  ) {
    this.update(this.router.url);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.update(event.urlAfterRedirects);
      }
    });
  }

  private update(url: string): void {
    if (this.nav.resolve(url)?.link.key === 'home') {
      this.crumbs.set([{ label: 'Home' }]);
      return;
    }
    let group: string | undefined;
    const levels: Crumb[] = [];
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route) {
      // routeConfig.data, not route.data: the latter merges parent data into
      // children and would hide the parent's own crumb.
      const data = route.routeConfig?.data;
      if (data) {
        group = group ?? data['group'];
        if (data['crumb']) {
          levels.push({ label: data['crumb'], link: data['crumbLink'] });
        }
      }
      route = route.firstChild;
    }
    const crumbs: Crumb[] = [...(group ? [{ label: group }] : []), ...levels];
    if (crumbs.length) {
      delete crumbs[crumbs.length - 1].link;
    }
    this.crumbs.set(crumbs);
  }
}
