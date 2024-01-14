import { NextFunction, Request, Response } from "express";
import { asyncWrapper } from "../../libraries/utils/asyncWrapper";
import auctioneer from "./auctioneerModel";
import AppError from "../../libraries/error";
import { hashPassword, isCorrectPassword } from "../../libraries/authentication";


/**
 * creates a new user document
 * @param req 
 * @param res 
 * @param next 
 * @returns authentication token
 */
export async function create(req: Request, res: Response, next: NextFunction) {
	const { firstName, lastName, email, password } = req.body;
	try {
		const hashedPassword = await hashPassword(password);
		const user = await auctioneer.create({firstName, lastName, email, password: hashedPassword});
		
		// res.status(201).json({message: 'Welcome. Account was successfully created', token});
		res.redirect(`/api/v1/auctions/dashboard?key=${user.apiKey}`);

	} catch(err) {
		if (err instanceof AppError && err.name === 'ValidationError'){
			const error = new AppError(err.name, err.message, err.isOperational, 400)
			error.setErrors(err.errors);
			return next(error);
		}
		return next(err);
	}
}
/**
 * logs the user in when credentials are correct
 * @param req express request object
 * @param res express response object
 * @param next function that calls the next middleware
 * @returns an authentication token
 */
export async function login(req: Request, res: Response, next: NextFunction){
	const { email, password } = req.body;
	const results = await asyncWrapper(auctioneer.getAuctioneerByEmail(email));
	if (results.error instanceof AppError && results.error.name === 'DocumentNotFoundError'){
		return next(new AppError('IncorrectCredentials', 'Invalid Email/Password', true, 400));
	}
	if (results.error) {
		const err = results.error
		return next(new AppError(err.name, err.message, false, 500));
	}
	const user = results.data;
	const pwd = user ? user.password : ''; 
	const isValidPassword = await isCorrectPassword(password, pwd);
	if (!isValidPassword){
		return next(new AppError('IncorrectCredentials', 'Invalid Email/Password', true, 400))
	}
	
	// res.status(200).json({message: 'successfully logged in', token});
	
	res.redirect(`/api/v1/auctions/dashboard?key=${user?.apiKey}`);
}

export function renderLoginPage(req: Request, res: Response){
	res.render('login');
}

export function renderSignUpPage(req: Request, res: Response){
	res.render('signup', {action: '/api/v1/auctioneers'})
}


export async function getProfile(req: Request, res: Response, next: NextFunction) {
	const { id } = req.params;
	const results = await asyncWrapper(auctioneer.getAuctioneerById(id));
	if (results.error instanceof AppError && results.error.name === 'DocumentNotFoundError'){
		const err = results.error;
		return next(new AppError(err.name, err.message, true, 404));
	}
	if (results.error instanceof AppError && results.error.name === 'InvalidIdType'){
		const err = results.error;
		return next(new AppError(err.name, err.message, true, 400));
	}
	if (results.error){
		const err = results.error;
		return next(new AppError(err.name, err.message, false, 500));
	}


	res.status(200).json(results.data);
}


