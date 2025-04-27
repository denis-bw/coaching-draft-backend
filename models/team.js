import Joi from 'joi';

const teamSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': 'Назва команди обовʼязкова',
    'string.empty': 'Назва не може бути порожньою'
  }),
  ageCategory: Joi.string().required().messages({
    'any.required': 'Вікова категорія обовʼязкова',
    'string.empty': 'Вікова категорія не може бути порожньою'
  }),
  athleteIds: Joi.array().items(Joi.string()).default([]),
});

export default teamSchema;
