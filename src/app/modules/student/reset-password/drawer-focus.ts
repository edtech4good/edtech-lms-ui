/**
 * Returns focus to the control that opened a drawer, once the drawer has gone: only while focus is lost (on the page
 * body, or still inside the drawer that is closing), so a user who has already moved on is not pulled back.
 */
export function restoreFocusAfterDrawer(selector: string): void {
  for (const delay of [0, 150, 400, 700]) {
    setTimeout(() => {
      const active = document.activeElement as HTMLElement | null;
      const lost = !active || active === document.body || !!active.closest('.ant-drawer');
      const control = document.querySelector(selector) as HTMLElement | null;
      if (control && lost) control.focus();
    }, delay);
  }
}
