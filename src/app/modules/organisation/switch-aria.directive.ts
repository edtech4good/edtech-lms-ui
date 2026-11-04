import { AfterViewChecked, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * ng-zorro's switch renders a plain button with no role and no aria-checked. This puts the switch semantics on that inner
 * button: role="switch", aria-checked following the value it is given (a click, Space or a change from code all come
 * through the bound value), and aria-describedby naming the help text.
 */
@Directive({ selector: 'nz-switch[appSwitchAria]', standalone: true })
export class SwitchAriaDirective implements AfterViewChecked {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly appSwitchAria = input.required<boolean>();
  readonly describedBy = input<string | null>(null);

  ngAfterViewChecked(): void {
    const button = this.host.nativeElement.querySelector('button');
    if (!button) return;
    button.setAttribute('role', 'switch');
    button.setAttribute('aria-checked', String(this.appSwitchAria() === true));
    const id = this.describedBy();
    if (id) button.setAttribute('aria-describedby', id);
    else button.removeAttribute('aria-describedby');
  }
}
