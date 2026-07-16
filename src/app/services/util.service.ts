import { Injectable } from '@angular/core';
import { UntypedFormGroup } from '@angular/forms';
// @ts-ignore
import fileExtension from 'file-extension';
import { compile, Schema, ValidationOptions } from 'joi';
import { typeCheck } from 'type-check';
import { replaceAll, stripBom, stripTags, trim } from 'voca';
import { FileType } from '../models/enums/filetype.enum';
import { FileMeta } from '../models/filemeta.model';
@Injectable({
  providedIn: 'root',
})
export class UtilService {
  constructor() {}
  checkFormDirty = (form: UntypedFormGroup) => {
    for (const i in form.controls) {
      if (form.controls.hasOwnProperty(i)) {
        form.controls[i].markAsDirty();
        form.controls[i].updateValueAndValidity();
      }
    }
  };
  readFileContent = (file: any): Promise<string | null> => {
    return new Promise<string | null>((resolve, reject) => {
      if (!file) {
        reject(null);
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = reader?.result?.toString();
        if (text) {
          resolve(text);
        } else {
          reject(null);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };
  convertToInt = (input: any): number | null => {
    if (typeCheck('Number', parseInt(input, 10))) {
      return parseInt(input, 10);
    } else {
      return null;
    }
  };

  validate = (
    schema: Schema,
    data: any,
    options?: ValidationOptions
  ): string | null => {
    const { error } = compile(schema).validate(data, {
      ...(options ? options : {}),
    });

    if (error) {
      return error.details.map((details) => details.message).join(', ');
    }
    return null;
  };

  cleantext = (text: string) =>
    text ? replaceAll(stripBom(stripTags(text)), ' ', '') : '';
  filemetaextractor = (filename: string): FileMeta => {
    const actualfilename = this.cleantext(trim(filename) || 'invalid');
    const fileext = this.cleantext(fileExtension(actualfilename) || 'invalid');
    let filetype = -1;
    switch (fileext.toLowerCase()) {
      case 'mp3':
        filetype = FileType.AUDIO;
        break;
      case 'jpg':
      case 'png':
      case 'jpeg':
      case 'gif':
        filetype = FileType.IMAGE;
        break;
      case 'mp4':
        filetype = FileType.VIDEO;
        break;
      default:
        filetype = FileType.INVALID;
    }
    return {
      filetype,
      filename: actualfilename,
      fileext,
    };
  };

  converttotree = (data: any, activeonly: boolean = false) =>
    data
      .filter((x: any) => (activeonly ? x.curriculumstatus === true : true))
      .map((curriculum: any) => {
        let tempc: any = {
          title: curriculum.curriculumname + ' (Curriculum)',
          key: curriculum.curriculumid,
          expanded: false,
          children: [],
          data: {
            ...curriculum,
            grades: [],
            type: 'CURRICULUM',
            status: curriculum.curriculumstatus,
          },
        };
        tempc.children = curriculum.grades
          .filter((x: any) => (activeonly ? x.gradestatus === true : true))
          .map((grade: any) => {
            const tempg: any = {
              title: grade.gradename + ' (Grade)',
              key: grade.gradeid,
              expanded: false,
              children: [],
              data: {
                ...grade,
                levels: [],
                type: 'GRADE',
                status: grade.gradestatus,
              },
            };
            tempg.children = grade.levels
              .filter((x: any) => (activeonly ? x.levelstatus === true : true))
              .map((level: any) => {
                const templev: any = {
                  title: level.levelname + ' (Level)',
                  key: level.levelid,
                  expanded: false,
                  children: [],
                  data: {
                    ...level,
                    lessons: [],
                    type: 'LEVEL',
                    status: level.levelstatus,
                  },
                };
                templev.children = level.lessons
                  .filter((x: any) =>
                    activeonly ? x.lessonstatus === true : true
                  )
                  .map((lesson: any) => {
                    const templesson = {
                      title: lesson.lessonname + ' (Lesson)',
                      key: lesson.lessonid,
                      isLeaf: false,
                      data: {
                        ...lesson,
                        type: 'LESSON',
                        status: lesson.lessonstatus,
                      },
                      children: [
                        {
                          title: 'Learning',
                          key: `Learning-${lesson.lessonid}`,
                          isLeaf: true,
                          data: { ...lesson, type: 'LEARNING', status: true },
                        },
                        {
                          title: 'Practice',
                          key: `${lesson.lessonid}`,
                          isLeaf: true,
                          data: {
                            ...lesson,
                            practices: [],
                            quizzes: [],
                            type: 'PRACTICE',
                            status: true,
                          },
                          children: lesson.practices
                            .filter((x: any) =>
                              activeonly
                                ? x.lessonpracticestatus === true
                                : true
                            )
                            .map((practice: any) => ({
                              title: practice.lessonpracticename,
                              key: `${practice.lessonpracticeid}`,
                              isLeaf: true,
                              data: {
                                ...practice,
                                type: 'PRACTICEQUESTION',
                                status: practice.lessonpracticestatus,
                              },
                            })),
                        },
                        {
                          title: 'Quiz',
                          key: `${lesson.lessonid}`,
                          isLeaf: true,
                          data: { ...lesson, type: 'QUIZ', status: true },
                          children: lesson.quizzes
                            .filter((x: any) =>
                              activeonly ? x.lessonquizstatus === true : true
                            )
                            .map((quiz: any) => ({
                              title: quiz.lessonquizname,
                              key: `${quiz.lessonquizid}`,
                              isLeaf: true,
                              data: {
                                ...quiz,
                                type: 'QUIZQUESTION',
                                status: quiz.lessonquizstatus,
                              },
                            })),
                        },
                      ],
                    };
                    templesson.isLeaf = templesson.children.length <= 0;
                    return templesson;
                  });
                templev.isLeaf = templev.children.length <= 0;
                return templev;
              });
            tempg.isLeaf = tempg.children.length <= 0;
            return tempg;
          });
        tempc.isLeaf = tempc.children.length <= 0;
        return tempc;
      });
}
