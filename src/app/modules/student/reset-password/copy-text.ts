/**
 * Copies text to the clipboard. The Clipboard API first; some browsers refuse it, so a temporary read-only textarea
 * that is selected and handed to the browser's copy command is the fallback. The textarea sits inside the drawer, off
 * screen and hidden from assistive technology, and is removed in every path. Focus goes back to the button pressed.
 * Resolves to whether the text was copied.
 */
export async function copyText(text: string, button: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelection(text, button);
  }
}

function copyBySelection(text: string, button: HTMLElement | null): boolean {
  const host = button?.closest('.dialog') ?? button?.parentElement;
  if (!host) return false;
  const area = document.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.tabIndex = -1;
  area.setAttribute('aria-hidden', 'true');
  area.style.cssText = 'position:fixed;top:0;left:-9999px;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none';
  try {
    host.appendChild(area);
    area.focus({ preventScroll: true });
    area.select();
    area.setSelectionRange(0, text.length); // iOS ignores select() alone
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
    button?.focus({ preventScroll: true });
  }
}
