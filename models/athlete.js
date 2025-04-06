import Joi from 'joi';

const athleteSchema = Joi.object({
  photo: Joi.object().allow(null),
  firstName: Joi.string().min(1).required(),
  lastName: Joi.string().min(1).required(),
  middleName: Joi.string().allow(null, ''),
  birthDate: Joi.date().required(),
  address: Joi.string().allow('', null),
  gender: Joi.string().valid('male', 'female', '').allow(null),
  phone: Joi.string().allow(null, ''),
  email: Joi.string().email().allow(null, ''),
  socialMedia: Joi.string().allow(null, ''),
  role: Joi.string().allow(null, ''),
  sportsRank: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  school: Joi.string().allow(null, ''),
  university: Joi.string().allow(null, ''),
  currentInstitution: Joi.string().min(1).required(), 
  coach: Joi.string().min(1).default('').required(), 
  coachContact: Joi.string().allow(null, ''),
  dateOfAdmission: Joi.date().required(), 
  
  previousCoaches: Joi.array().items(
    Joi.object({
      previousCoach: Joi.string().min(1).required(), 
      previousInstitution: Joi.string().allow(null, ''), 
      coachContacts: Joi.string().allow(null, ''), 
      entryDate: Joi.date().allow(null), 
      exitDate: Joi.date().allow(null), 
    })
  ).optional().allow(null), 

  medicalExaminations: Joi.array().items(
    Joi.object({
      doctorName: Joi.string().min(1).required(), 
      healthStatus: Joi.string().min(1).required(), 
      medicalInstitution: Joi.string().allow(null, ''), 
      examinationDate: Joi.date().required(), 
    })
  ).optional().allow(null), 
  
  relatives: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).required(), 
      contacts: Joi.string().min(1).required(), 
      relationship: Joi.string().allow(null, ''), 
    })
  ).optional().allow(null),
}).unknown(true);

export default athleteSchema;