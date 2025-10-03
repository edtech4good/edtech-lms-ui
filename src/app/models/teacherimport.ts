export interface TeacherImport {
  schoolusername: string;
  schooluserpasswordhash: string;
}

export class TeacherImportBody {
  schoolname: string = '';
  teachers: Array<TeacherImport> = [];
}
