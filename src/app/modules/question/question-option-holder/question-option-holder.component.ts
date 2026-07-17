import {
  Component,
  Input,
  OnInit,
  QueryList,
  ViewChildren,
} from '@angular/core';
import { UntypedFormBuilder } from '@angular/forms';
import { uniq } from 'lodash';
import { QuestionOption } from 'src/app/models/questionoption.model';
import { UtilService } from 'src/app/services/util.service';
import { v4 as uuidv4 } from 'uuid';
import { QuestionOptionComponent } from '../question-option/question-option.component';

@Component({
    selector: 'app-question-option-holder',
    templateUrl: './question-option-holder.component.html',
    styleUrls: ['./question-option-holder.component.less'],
    standalone: false
})
export class QuestionOptionHolderComponent implements OnInit {
  @ViewChildren(QuestionOptionComponent)
  questionOptions?: QueryList<QuestionOptionComponent>;
  listOfOption: Array<QuestionOption> = [];
  _templateType: number = 0;
  get templateType(): number {
    return this._templateType;
  }
  @Input() set templateType(value: number) {
    this._templateType = value;
    this.listOfOption = [];
    if (value > 0) {
      this.addField();
    }
    this.optionsLoading = false;
  }
  optionsLoading = true;
  errorText = '';
  addField(e?: MouseEvent): void {
    if (e) {
      e.preventDefault();
    }
    const Optioncontrol: QuestionOption = {
      questionoptionid: uuidv4(),
      questionoptiontext: '',
      questionoptionsequence: this.listOfOption.length + 1,
    };
    this.listOfOption.push(Optioncontrol);
  }
  removeField(data: QuestionOption, e: MouseEvent): void {
    e.preventDefault();
    if (this.listOfOption.length > 1) {
      const index = this.listOfOption.findIndex(
        (x) => x.questionoptionid === data.questionoptionid
      );
      this.listOfOption.splice(index, 1);
    }
  }
  validateForm = (): boolean => {
    let valid = true;
    let questionOptionslist: Array<QuestionOption> = [];
    this.questionOptions?.forEach((x) => {
      this.utilService.checkFormDirty(x.questionOptionForm);
      const tempOption = x.getFormValue();
      if (!tempOption) {
        valid = false;
      } else {
        questionOptionslist.push(tempOption);
      }
    });
    if (!valid) {
      return valid;
    }
    if (
      (this.templateType <= 4 || this.templateType === 8) &&
      questionOptionslist.length > 0 &&
      !questionOptionslist.some((x) => x.questionoptioniscorrect)
    ) {
      this.questionOptions?.forEach((x) => x.triggerisCorrectError(true));
      valid = false;
      return valid;
    } else {
      this.questionOptions?.forEach((x) => x.triggerisCorrectError(false));
    }
    if (this.templateType === 5) {
      let tempdata: Array<string> = [];
      this.questionOptions?.forEach((x) => {
        const tempOption = x?.getFormValue();
        if (tempOption) {
          tempdata.push(tempOption.questionoptiontext || '');
        }
      });
      if (tempdata.join().trim().length > 100) {
        this.questionOptions?.forEach((x) =>
          x.triggerquestionoptiontextError(
            true,
            'Option text combined must not exceed 100 characters'
          )
        );
        valid = false;
        return valid;
      } else {
        this.questionOptions?.forEach((x) =>
          x.triggerquestionoptiontextError(false)
        );
      }
    }

    if ([1, 2, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17].includes(this.templateType) &&
      this.questionOptions &&
      this.questionOptions?.length < 2
    ) {
      this.errorText = 'At least 2 options required';
      valid = false;
      return valid;
    } else {
      this.errorText = '';
    }

    if (
      [3, 4].includes(this.templateType) &&
      this.questionOptions &&
      this.questionOptions?.length < 3
    ) {
      this.errorText = 'At least 3 options required';
      valid = false;
      return valid;
    } else {
      this.errorText = '';
    }

    if (
      [2, 1].includes(this.templateType) &&
      questionOptionslist?.filter((x) => x.questionoptioniscorrect || false)
        .length != 1
    ) {
      this.errorText = 'Only 1 option must be correct';
      valid = false;
      return valid;
    } else {
      this.errorText = '';
    }
    if (
      [3, 4].includes(this.templateType) &&
      questionOptionslist?.filter((x) => x.questionoptioniscorrect || false)
        .length < 2
    ) {
      this.errorText = 'Please select atleast 2 correct options';
      valid = false;
      return valid;
    } else {
      this.errorText = '';
    }

    if ([1, 2, 3, 4].includes(this.templateType) && questionOptionslist) {
      const tempQuestiontype =
        questionOptionslist.map((x) => {
          if (x.questionoptionfile && x.questionoptiontext) {
            return 1;
          } else if (x.questionoptiontext) {
            return 2;
          } else {
            return 0;
          }
        }) || [];
      if (
        tempQuestiontype.length !== questionOptionslist.length ||
        uniq(tempQuestiontype).length > 1
      ) {
        this.errorText =
          'All the Options must be of same format either text or file';
        valid = false;
        return valid;
      }
    } else {
      this.errorText = '';
    }

    return valid;
  };
  getFormValue = (): Array<QuestionOption> | null => {
    if (this.validateForm()) {
      const tempOptions: Array<QuestionOption> = [];
      if (this.questionOptions) {
        for (let index = 0; index < this.questionOptions.length; index++) {
          const element = this.questionOptions.get(index);
          const tempOption = element?.getFormValue();
          if (tempOption) {
            tempOptions.push(tempOption);
          }
        }
      }
      return tempOptions;
    } else {
      return null;
    }
  };
  constructor(private fb: UntypedFormBuilder, private utilService: UtilService) {}
  ngOnInit(): void {
    this.addField();
    this.optionsLoading = false;
  }
  setForm = (data: Array<QuestionOption>) => {
    this.optionsLoading = true;
    setTimeout(() => {
      this.listOfOption = data;
      setTimeout(() => {
        for (let index = 0; index < this.listOfOption.length; index++) {
          if (this.questionOptions) {
            this.questionOptions.get(index)?.setForm(this.listOfOption[index]);
          }
        }
        this.optionsLoading = false;
      }, 500);
    }, 1000);
  };
}
