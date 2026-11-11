import { Directive, ElementRef, afterEveryRender, inject, input } from '@angular/core';

/**
 * Puts attributes on the focusable input INSIDE an nz-select, not on its host. `aria-describedby` set on the host
 * (`<nz-select>`) is read by no assistive technology, because the host is not the element that has focus; the select's
 * own `<input>` is. Applied after every render, so it follows the select's own redraws.
 */
@Directive({ selector: '[appSelectInputAttrs]', standalone: true })
export class SelectInputAttrsDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly appSelectInputAttrs = input<Record<string, string | null>>({});

  constructor() {
    afterEveryRender(() => {
      const input = this.host.nativeElement.querySelector('input');
      if (!input) return;
      for (const [name, value] of Object.entries(this.appSelectInputAttrs())) {
        if (value === null) input.removeAttribute(name);
        else if (input.getAttribute(name) !== value) input.setAttribute(name, value);
      }
    });
  }
}
