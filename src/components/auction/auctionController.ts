import AppError from "../../libraries/error";
import liveAuction from "./auctionModel";
import { Request, Response, NextFunction } from 'express';

export async function createLiveAuction(req: Request, res: Response, next: NextFunction){
	const {auctionData, itemData} = req.body
	try {
		const results = await liveAuction.createAuction(auctionData, itemData)
		res.status(201).json(results);
	} catch (err) {
		if (err instanceof AppError && err.name === 'ValidationError') {
			const error = new AppError(err.name, err.message, err.isOperational, 400)
			error.setErrors(err.errors);
			next(error);
		}
		next(err);
	}
}

