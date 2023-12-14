import { NextFunction, Request, Response } from "express";
// import { asyncWrapper } from "../../libraries/utils/asyncWrapper";
import auctioneer from "./auctioneerModel";
import AppError from "../../libraries/error";

export async function create(req: Request, res: Response, next: NextFunction) {
	const { firstName, lastName, email, password } = req.body;
	try {
		const results = await auctioneer.create({firstName, lastName, email, password});
		res.status(201).json(results);
	} catch(err) {
		if (err instanceof AppError && err.name === 'ValidationError'){
			const error = new AppError(err.name, err.message, err.isOperational, 400)
			error.setErrors(err.errors);
			next(error);
		}
		next(err);
	}
}


