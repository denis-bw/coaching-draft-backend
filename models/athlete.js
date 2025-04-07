import Joi from 'joi';

const athleteSchema = Joi.object({
  photo: Joi.string().allow(null, ''),
  firstName: Joi.string().min(1).required(), //
  lastName: Joi.string().min(1).required(), //
  patronymic: Joi.string().allow(null, ''),  
  birthdate: Joi.date().required(),         
  gender: Joi.string().allow(null, ''),         
  address: Joi.string().allow('', null),
  phone: Joi.string().allow(null, ''),
  email: Joi.string().allow(null, ''),       
  socialMedia: Joi.string().allow(null, ''),
  role: Joi.string().allow(null, ''),
  sportCategory: Joi.string().allow(null, ''), 
  notes: Joi.string().allow(null, ''),
  school: Joi.string().allow(null, ''),
  university: Joi.string().allow(null, ''),
  name: Joi.string().allow(null, ''),       
  trainer: Joi.string().required(),        
  trainerContacts: Joi.string().allow(null, ''), 
  entryDate: Joi.date().required(),        
  
  previousEstablishments: Joi.array().items( 
    Joi.object({
      previousCoach: Joi.string().min(1).required(), //
      previousInstitution: Joi.string().allow(null, ''),
      coachContacts: Joi.string().allow(null, ''),
      entryDate: Joi.string().allow(null, ''),  
      exitDate: Joi.string().allow(null, ''),
    })
  ).optional().allow(null),
  
  medicalInformation: Joi.array().items(  
    Joi.object({
      doctorName: Joi.string().min(1).required(),
      healthStatus: Joi.string().min(1).required(),
      medicalInstitution: Joi.string().allow(null, ''),
      examinationDate: Joi.string().required(), 
    })
  ).optional().allow(null),
  
  parentsInformation: Joi.array().items(    
    Joi.object({
      name: Joi.string().min(1).required(),
      contacts: Joi.string().min(1).required(),
      relationship: Joi.string().allow(null, ''),
    })
  ).optional().allow(null),
}).unknown(true);

export default athleteSchema;