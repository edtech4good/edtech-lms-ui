export interface StudentImport {
  studentfirstname: string;
  studentlastname: string;
  mothername: string;
  fathername: string;
  contact: string;
  dateofbirth: null;
  genderid: string;
  // Washington Group Short Set; blank = not collected.
  wg_seeing?: string;
  wg_hearing?: string;
  wg_walking?: string;
  wg_remembering?: string;
  wg_selfcare?: string;
  wg_communicating?: string;
  standard: string;
  schooltype: string;
  city: string;
  country: string;
  state: string;
  dateofjoin: string;
  schoolusername: string;
  schooluserpasswordhash: string;
  type: string;
  is_teacher_acc: string;
}

export class StudentImportBody {
  curriculumid: string = '';
  schoolid: string = '';
  standard: string = '';
  students: Array<StudentImport> = [];
}

export class StudentEditedImportBody {
  students: Array<StudentImportForEdit> = [];
}

export interface StudentImportForEdit {
  studentid: string,
  schooluserid: string,
  studentfirstname: string;
  studentlastname: string;
  familyname: string;
  mothername: string;
  fathername: string;
  contact: string;
  dateofbirth: string;
  genderid: string;
  wg_seeing?: string;
  wg_hearing?: string;
  wg_walking?: string;
  wg_remembering?: string;
  wg_selfcare?: string;
  wg_communicating?: string;
  standard: string;
  schoolname: string;
  schooltype: string;
  city: string;
  country: string;
  state: string;
  dateofjoin: string;
  schoolusername: string;
  type: string;
  isactive: number;
  is_teacher_acc: string;

  new_type: string;
  new_studentfirstname: string;
  new_studentlastname: string;
  new_familyname: string;
  new_mothername: string;
  new_fathername: string;
  new_contact: string;
  new_dateofbirth: string;
  new_genderid: string;
  new_standard: string;
  new_schoolname: string;
  new_schooltype: string;
  new_city: string;
  new_country: string;
  new_state: string;
  new_dateofjoin: string;
  new_schoolusername: string;
  new_schooluserpasswordhash: string;
  new_isactive: number;
}
