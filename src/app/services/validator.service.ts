import { isValid, parse } from 'date-fns';
import joi, { CustomHelpers } from 'joi';

export const dateString =
  (optional = false, replaceString = '') =>
  (value: string, helpers: CustomHelpers) => {
    if (optional && !value) {
      return value;
    }
    let msg = helpers?.state?.path + ` not valid `;
    msg = msg.replace(replaceString, '');
    return isValid(parse(value, 'dd-MM-yyyy', new Date()))
      ? value
      : helpers.message({
          custom: msg,
        });
  };

export const uploadStudentsValidationSchema = joi
  .array()
  .items(
    joi.object().keys({
      city: joi.string().min(2).max(100).required(),
      contact: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      country: joi.string().min(2).max(100).required(),
      dateofbirth: joi
        .string()
        .optional()
        .custom(dateString(true))
        .min(10)
        .max(10)
        .allow('', null),
      dateofjoin: joi
        .string()
        .min(8)
        .custom(dateString(false))
        .max(10)
        .required(),
      studentfirstname: joi.string().min(2).alphanum().max(100).required(),
      studentlastname: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      familyname: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      mothername: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      fathername: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      genderid: joi.string().valid('1', '2').required(),
      state: joi.string().max(100).required(),
      schoolusername: joi.string().min(2).max(16).alphanum().required(),
      schooluserpasswordhash: joi.string().min(1).max(16).alphanum().required(),
      type: joi.string().valid("offline", "online").required(),
      is_teacher_acc: joi.string().valid("1", "0").allow("").optional(),
    })
  )
  .required()
  .min(1)
  .max(500);

export const uploadTeachersValidationSchema = joi
  .array()
  .items(
    joi.object().keys({
      schoolusername: joi.string().min(2).max(16).alphanum().required(),
      schooluserpasswordhash: joi.string().min(1).max(16).alphanum().required(),
    })
  )
  .required()
  .min(1)
  .max(500);


export const uploadEditedStudentsValidationSchema = joi
  .array()
  .items(
    joi.object().keys({
      studentid: joi.string().required().uuid().label("Student ID"),
      schooluserid: joi.string().required().uuid().label("School User ID"),
      studentfirstname: joi.string().min(2).max(100).required(),
      studentlastname: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      familyname: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      mothername: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      fathername: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      genderid: joi.string().valid('1', '2').required(),
      contact: joi
        .string()
        .optional()
        .min(1)
        .max(100)
        .allow('', null)
        .default(''),
      city: joi.string().min(2).max(100).required(),
      country: joi.string().min(2).max(100).required(),
      state: joi.string().max(100).required(),
      schoolusername: joi.string().min(2).max(16).required(),
      schoolname: joi.string().min(2).max(255),
      schooltype: joi.string().min(2).max(255).allow('', null),
      standard: joi.string().min(2).max(255).allow('', null),
      schooluserpasswordhash: joi.string().min(6).max(16).alphanum().allow('', null),
      dateofbirth: joi
        .string()
        .optional()
        .custom(dateString(true))
        .min(10)
        .max(10)
        .allow('', null),
      dateofjoin: joi
        .string()
        .min(8)
        .custom(dateString(false))
        .max(10)
        .required(),
      type: joi.string().valid("offline", "online", "all").allow("", null),
      isactive: joi.number().valid(1, 0).required(),
      is_teacher_acc: joi.string().valid("1", "0").allow("").optional(),
      curriculums: joi.string().required().label("Curriculums ID"),
    })
  )
  .required()
  .min(1)
  .max(500);
