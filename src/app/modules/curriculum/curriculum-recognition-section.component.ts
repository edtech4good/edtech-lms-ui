import { Component, input } from '@angular/core';
import { ReactiveFormsModule, UntypedFormGroup } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  HELP_AWARDS_KEPT,
  HELP_LEVEL_CERTIFICATE,
  HELP_REPUBLISH,
  RECOGNITION_TIERS,
  RecognitionField,
  showsLevelCertificateNote,
} from './curriculum-recognition';

/**
 * The "Recognition" section of the curriculum add and edit forms: one select per tier (level, grade, curriculum), each offering
 * only what that tier accepts. The form group carries the three controls (the page owns it); `errors` are the API's sentences for
 * a tier it refused, shown beside that select. (Default change detection: the level's extra line follows the control's value.)
 */
@Component({
  selector: 'app-curriculum-recognition-section',
  standalone: true,
  imports: [ReactiveFormsModule, NzFormModule, NzSelectModule],
  template: `
    <div class="recognition" data-testid="recognition-section" [formGroup]="form()">
      <h4 class="recognition-title">Recognition</h4>
      @for (tier of tiers; track tier.field) {
        <nz-form-item>
          <nz-form-label [nzSm]="6" [nzXs]="24" [nzFor]="tier.field">{{ tier.label }}</nz-form-label>
          <nz-form-control
            [nzValidateStatus]="errors()[tier.field] ? 'error' : ''"
            [nzErrorTip]="errorTip"
          >
            <nz-select
              [nzId]="tier.field"
              [formControlName]="tier.field"
              [nzPlaceHolder]="placeholder()"
              [attr.data-testid]="'recognition-' + tier.field"
            >
              @for (option of tier.options; track option.value) {
                <nz-option [nzLabel]="option.label" [nzValue]="option.value"></nz-option>
              }
            </nz-select>
            <ng-template #errorTip>
              <span [attr.data-testid]="'recognition-error-' + tier.field">{{ errors()[tier.field] }}</span>
            </ng-template>
            @if (tier.field === 'levelrecognition' && levelCertificate()) {
              <div class="recognition-note" data-testid="recognition-level-certificate">{{ helpLevelCertificate }}</div>
            }
          </nz-form-control>
        </nz-form-item>
      }
      <p class="recognition-help" data-testid="recognition-help">{{ helpRepublish }}</p>
      <p class="recognition-help" data-testid="recognition-help-awards">{{ helpAwardsKept }}</p>
    </div>
  `,
  styles: [
    `
      .recognition-title {
        margin: 16px 0 12px;
        font-weight: 600;
      }
      .recognition-help,
      .recognition-note {
        margin: 4px 0 0;
        font-size: 12px;
        color: var(--color-text-2-dark, #667085);
      }
    `,
  ],
})
export class CurriculumRecognitionSectionComponent {
  form = input.required<UntypedFormGroup>();
  errors = input<Partial<Record<RecognitionField, string>>>({});
  /** What a select with no value says: "Organisation default" on add when the preset could not be read, "Not set" on edit. */
  placeholder = input('Organisation default');

  readonly tiers = RECOGNITION_TIERS;
  readonly helpRepublish = HELP_REPUBLISH;
  readonly helpAwardsKept = HELP_AWARDS_KEPT;
  readonly helpLevelCertificate = HELP_LEVEL_CERTIFICATE;

  levelCertificate(): boolean {
    return showsLevelCertificateNote(this.form().get('levelrecognition')?.value ?? null);
  }
}
