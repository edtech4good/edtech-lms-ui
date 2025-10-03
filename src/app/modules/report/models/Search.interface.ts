export interface studentgradesearch {
    curriculumid: string;
    gradeid: string;
    schoolname: string;
    studentid: string
}

export interface studentlevelprogresssearch {
    curriculumid: string;
    gradeid: string;
    levelid: string;
    studentid: string
}

export interface studentlessonprogresssearch {
    curriculumid: string;
    gradeid: string;
    levelid: string;
    lessonid: string;
    studentid: string
}

export interface studentactivitysearch {
    countryid: string,
    schoolname: string,
    standardid: string,
    studentid: string,
    startDate: Date | string,
    endDate: Date | string,
}

export interface studentallquizsearch {
    curriculumid: string;
    gradeid: string;
    levelid: string;
    lessonid: string;
    countryid: string;
    schoolname: string;
    studentid: string
}

export interface teacherfeedback {
    countryid: string,
    schoolname: string,
    startDate: Date | string,
    endDate: Date | string,
}
