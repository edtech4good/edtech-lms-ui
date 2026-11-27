import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgxPermissionsService } from 'ngx-permissions';
import { map } from 'rxjs/operators';
import { REPORT_HUB, ReportHubLink, ReportHubSection, hubLinkVisible, hubSectionVisible } from '../../shell/shell-nav.config';
import { ShellNavService } from '../../shell/shell-nav.service';

/**
 * The Reports hub (/report): every dashboard and report in one place, as link
 * cards in sections. Each link, and each section, shows only for users who may
 * open it. The lists and their permissions live in shell-nav.config.ts, next to
 * the "Reports" menu item that is gated by the same keys.
 */
@Component({
  selector: 'app-report-index',
  standalone: false,
  templateUrl: './report-index.component.html',
  styleUrls: ['./report-index.component.less'],
})
export class ReportIndexComponent {
  readonly sections = REPORT_HUB;

  /** The permission names the user holds now; it follows the permissions as the shell loads them. */
  private readonly held = toSignal(
    inject(NgxPermissionsService).permissions$.pipe(map((p) => Object.keys(p))),
    { initialValue: Object.keys(inject(NgxPermissionsService).getPermissions()) },
  );

  /** Any-of for most links, all-of for the ones that say so (Learner progress): see hubLinkVisible. */
  linkVisible(link: ReportHubLink): boolean {
    return hubLinkVisible(link, this.held());
  }

  sectionVisible(section: ReportHubSection): boolean {
    return hubSectionVisible(section, this.held());
  }

  /** Reach is Home's screen for users who hold it, so the hub does not repeat it. */
  constructor(readonly nav: ShellNavService) {}
}
