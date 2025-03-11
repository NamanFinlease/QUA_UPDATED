import Joi from "joi";

const employeeValidationSchema = Joi.object({
    empId: Joi.string().required().messages({
        "string.empty": "Employee ID is required.",
        "any.required": "Employee ID is required.",
    }),
    fName: Joi.string().required().messages({
        "string.empty": "First name is required.",
        "any.required": "First name is required.",
    }),
    lName: Joi.string().optional(),
    email: Joi.string().email().required().messages({
        "string.email": "Invalid email format.",
        "string.empty": "Email is required.",
        "any.required": "Email is required.",
    }),
    password: Joi.string().required().messages({
        "string.min": "Password must be at least 6 characters long.",
        "string.empty": "Password is required.",
        "any.required": "Password is required.",
    }),
    password: Joi.string().required().messages({
        "string.min": "Password must be at least 6 characters long.",
        "string.empty": "Password is required.",
        "any.required": "Password is required.",
    }),
    confPassword: Joi.string().required().valid(Joi.ref("password")).messages({
        "any.only": "Confirm password must match password.",
        "string.empty": "Confirm password is required.",
        "any.required": "Confirm password is required.",
    }),
    gender: Joi.string().valid("M", "F").required().messages({
        "any.only": 'Gender must be either "M" or "F".',
        "string.empty": "Gender is required.",
        "any.required": "Gender is required.",
    }),
    mobile: Joi.number().integer().required().messages({
        "number.base": "Mobile number must be a valid number.",
        "number.empty": "Mobile number is required.",
        "any.required": "Mobile number is required.",
    }),
    empRole: Joi.array().items(Joi.string()).required().messages({
        "array.base": "Employee roles must be an array of strings.",
        "any.required": "Employee roles are required.",
    }),
    isActive: Joi.boolean().optional(),
});

export default employeeValidationSchema;
