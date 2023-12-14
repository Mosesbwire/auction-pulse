import { Request, Response, NextFunction } from 'express';
import { body, ContextRunner, validationResult } from 'express-validator';
import AppError from '../libraries/error';
import { error } from '../libraries/constants';
import { asyncWrapper } from '../libraries/utils/asyncWrapper';
import auctioneer from '../components/auctioneers/auctioneerModel';


async function validate(validations: ContextRunner[], req: Request, res:Response, next: NextFunction) {
	for (const validation of validations){
		await validation.run(req);
	}
	const errors = validationResult(req);
	if (!errors.isEmpty()){
		const err = new AppError('ValidationError', 'Failed validations', true, 400);
		const validationErr: error[] = []
		
		for (const e of errors.array()){
			if (e.type === 'field'){
				const obj: error = {}
				obj[e.path] = e.msg
				validationErr.push(obj);
			}
		}

		err.setErrors(validationErr);
		return next(err);
	}

}
/**
 * Validates user data used in sign up action
 * @param req request object
 * @param res response object
 * @param next next function calls next middleware 
 */
export async function validateSignUpData(req: Request, res: Response, next: NextFunction) {
	const validations = [
		body('firstName').trim().notEmpty().withMessage('First name cannot be empty'),
		body('lastName').trim().notEmpty().withMessage('Last name cannot be empty'), 
		body('email').trim().notEmpty().withMessage('Email cannot be empty').bail().isEmail().withMessage('Invalid email format'),
		body('password').trim().notEmpty().withMessage('Password cannot be empty').bail().isLength({min: 6}).withMessage('Password should be at least 6 characters'),
		body('confirmPassword').trim().notEmpty().withMessage('confirm password cannot be empty').bail()
	]
	await validate(validations, req, res, next);
	const results = await asyncWrapper(auctioneer.getAuctioneerByEmail(req.body.email));
	if (results.data){
		return next(new AppError('EmailNotUniqueError', 'user with email already exists', true, 400));
	}
	next();
}