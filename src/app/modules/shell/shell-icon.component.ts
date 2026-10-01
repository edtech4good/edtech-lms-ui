import { Component, Input } from '@angular/core';
import { SHELL_ICONS, ShellIconName } from './shell-icons';

/**
 * One inline SVG icon: 24 x 24 viewBox, 2px stroke, round caps and joins,
 * coloured by `currentColor`. Decorative: the label lives next to it.
 */
@Component({
  selector: 'app-shell-icon',
  standalone: false,
  template: `<svg
    [attr.width]="size"
    [attr.height]="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path [attr.d]="path" />
  </svg>`,
  styles: [':host { display: inline-flex; flex-shrink: 0; line-height: 0; }'],
})
export class ShellIconComponent {
  @Input({ required: true }) name!: ShellIconName;
  @Input() size = 16;

  get path(): string {
    return SHELL_ICONS[this.name];
  }
}
