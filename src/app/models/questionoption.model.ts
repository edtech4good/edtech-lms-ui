import { FileMeta } from './filemeta.model';
import { QuestionAssociate } from './questionassociate.model';

export class QuestionOption {
  optionassociatetext?:string;
  optionassociatefile?:string;
  questionoptionid: string = '';
  questionoptionfile?: FileMeta;
  questionoptiontext?: string;
  questionoptioniscorrect?: boolean;
  questionoptionsequence?: number;
  questionassociate?: QuestionAssociate;
  questionoptionisstaticfile?: boolean;
  questionoptionvalue?: number;
  questionoptionnumeratorvalue?: string;
  questionoptionnumeratorisstatic?: boolean;
  questionoptiondenominatorvalue?: string;
  questionoptiondenominatorisstatic?: boolean;
  questionoptionisfraction?: boolean;
  questionoptionistext?: boolean;
}
