import Joi from 'joi';

export const userSignupSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email повинен бути дійсною електронною адресою',
    'any.required': 'Email є обов’язковим',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль повинен містити щонайменше 6 символів',
    'any.required': 'Пароль є обов’язковим',
  }),
  username: Joi.string().min(3).required().messages({
    'string.min': "Ім'я користувача повинно містити щонайменше 3 символи",
    'any.required': "Ім'я користувача є обов’язковим",
  }),
});

export const userSigninSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email повинен бути дійсною електронною адресою',
    'any.required': 'Email є обов’язковим',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль повинен містити щонайменше 6 символів',
    'any.required': 'Пароль є обов’язковим',
  }),
});

export const userEmailSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Email повинен бути дійсною електронною адресою',
    'any.required': 'Email є обов’язковим',
  }),
});

export const userPasswordSchema = Joi.object({
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль повинен містити щонайменше 6 символів',
    'any.required': 'Пароль є обов’язковим',
  }),
});
