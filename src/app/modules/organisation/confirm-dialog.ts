import { ModalOptions, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';

/**
 * An nz-modal confirm, announced as an alert dialog. ng-zorro gives a modal's
 * content role="document" and no name, so a screen reader does not know a dialog
 * has opened; this names it after its title.
 */
export function confirmDialog(
  modal: NzModalService,
  options: ModalOptions & { nzTitle: string },
): NzModalRef {
  const ref = modal.confirm(options);
  setTimeout(() => {
    const host = ref.getElement() as HTMLElement | undefined;
    const target = host?.querySelector<HTMLElement>('.ant-modal') ?? host;
    target?.setAttribute('role', 'alertdialog');
    target?.setAttribute('aria-modal', 'true');
    target?.setAttribute('aria-label', options.nzTitle);
  }, 0);
  return ref;
}
