import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { QuestionDistractor } from 'src/app/models/questiondistractor.model';
import { UtilService } from 'src/app/services/util.service';
import { v4 as uuidv4 } from 'uuid';
@Component({
  selector: 'app-question-distractor',
  templateUrl: './question-distractor.component.html',
  styleUrls: ['./question-distractor.component.less']
})
export class QuestionDistractorComponent implements OnInit {

  public questionDistractorForm!: FormGroup;
  listOfDistractor: Array<QuestionDistractor> = [];

  addField(e?: MouseEvent): void {
    if (e) {
      e.preventDefault();
    }
    const Distractorcontrol: QuestionDistractor = {
      questiondistractorid: uuidv4(),
      questiondistractortext: ''
    };
    this.listOfDistractor = [...this.listOfDistractor, Distractorcontrol];
    this.questionDistractorForm.addControl(
      Distractorcontrol.questiondistractorid,
      new FormControl(null, [Validators.minLength(1)])
    );
  }

  removeField(data: QuestionDistractor, e: MouseEvent): void {
    e.preventDefault();
    const index = this.listOfDistractor.findIndex(x => x.questiondistractorid === data.questiondistractorid);
    this.listOfDistractor.splice(index, 1);
    this.questionDistractorForm.removeControl(data.questiondistractorid);
  }

  constructor(private fb: FormBuilder, private utilService: UtilService) { }

  ngOnInit(): void {
    this.questionDistractorForm = this.fb.group({});
    this.addField();
  }

  validateForm = (): boolean => {
    this.utilService.checkFormDirty(this.questionDistractorForm);
    return this.questionDistractorForm.valid;
  }

  setForm = (data: Array<QuestionDistractor>) => {
    this.listOfDistractor = [...data];
    this.listOfDistractor.forEach(x => {
      this.questionDistractorForm.addControl(
        x.questiondistractorid,
        new FormControl(null, [Validators.required, Validators.minLength(1)])
      );
      this.questionDistractorForm.get(x.questiondistractorid)?.setValue(x.questiondistractortext);
    })
  }

  getFormValue = (): Array<QuestionDistractor> | null => this.validateForm() ? this.listOfDistractor.map(x => ({ ...x, questiondistractortext: this.questionDistractorForm.get(x.questiondistractorid)?.value })) : null;

}
