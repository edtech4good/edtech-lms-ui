import { Component } from '@angular/core';
import { REPORT_HUB } from '../../shell/shell-nav.config';

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
}
