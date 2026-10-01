import { Component, Input } from '@angular/core';

/**
 * The shared frame for the signed-out pages (sign in, change password): a
 * decorative panel on the left, and a white card on the right holding the logo,
 * the page's one <h1> and whatever the page projects in (its form).
 *
 * The panel is a plain tint with the logo mark. No artwork has been supplied, so
 * there is none; it is hidden under 900px so the card has the whole width.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: false,
  templateUrl: './auth-layout.component.html',
  styleUrls: ['./auth-layout.component.less'],
})
export class AuthLayoutComponent {
  /** The page's <h1>. */
  @Input({ required: true }) heading!: string;
  /** One line under the heading. */
  @Input() subheading = '';
}
