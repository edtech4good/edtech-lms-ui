import { FileMeta } from './filemeta.model';
import { QuestionDistractor } from './questiondistractor.model';
import { QuestionHeading } from './questionheading.model';
import { QuestionOption } from './questionoption.model';

export class Question {
  questionid: string = '';
  questionidentifier: string = '';
  questionheading?: QuestionHeading;
  questionoptions: Array<QuestionOption> = [];
  questiontext?: string; // null for 8
  questiondistractors?: Array<QuestionDistractor>; // only for 8
  questionfile?: FileMeta; // only for 1 2 3
  templatetypeid: number = 0;
  isdeleted: boolean = false;
  questionstatus: boolean = true;
  questiontags: Array<string> = [];
  questioncorrectvalue: number = 0;
}
