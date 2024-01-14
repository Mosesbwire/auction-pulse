import AppError from "../../libraries/error";
import { asyncWrapper } from "../../libraries/utils/asyncWrapper";
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
			return next(error);
		}
		return next(err);
	}
}

export async function getAuctions(req: Request, res: Response, next: NextFunction){
	const { user } = req.params
	
	const results = await asyncWrapper(liveAuction.getAuctions(user));
	if (results.error) return next(results.error);
	res.status(200).json(results.data)
}

export async function getAuctionById(req: Request, res: Response, next: NextFunction) {
	const { auctionId } = req.params
	const results = await asyncWrapper(liveAuction.getAuctionById(auctionId));
	if (results.error) return next(results.error);
	res.status(200).json(results.data);
}

export async function updateAuction(req: Request, res: Response, next: NextFunction){
	const { auctionId } = req.params
	const { auctionData , itemData } = req.body
	const results = await asyncWrapper(liveAuction.update(auctionId, auctionData, itemData));
	if (results.error) return next(results.error);
	res.status(200).json(results.data);
}

export async function deleteAuction(req: Request, res: Response, next: NextFunction){
	const { auctionId } = req.params
	const results = await asyncWrapper(liveAuction.delete(auctionId));
	if (results.error) return next(results.error);
	res.status(200).json(results.data);
}

export function renderDashboard(req:Request, res:Response){
	const { key } = req.query
	
	res.render('dashboard', { key });
}

