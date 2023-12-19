/**
 * represents the auction object
 */
import Auction  from "./auction";
import mongoose, { ObjectId } from 'mongoose';
import AppError from "../../libraries/error";
import { error } from "../../libraries/constants";
import { asyncWrapper } from "../../libraries/utils/asyncWrapper";

interface IAuction {
	auctioneer: ObjectId,
	startDate: Date,
	bidIncrement: number,
	name?: string
}

interface Item {
	title: string,
	description? : string,
	reservePrice: number
}
class LiveAuction {
	/**
	 * creates instance of auction and save to database
	 * @param auctionData object containing data to create auction
	 * @param itemData object with data to create the item subdocument
	 * @returns created auction document
	 */
	async createAuction(auctionData: IAuction, itemData: Item){
		
		// auctionData.startDate = new Date(Date.now() + 5 * 3600 * 1000);
		try {
			let auction = new Auction({ ...auctionData, item: itemData })
			auction = await auction.save()
			return auction
		} catch(err){
			if (err instanceof mongoose.Error.ValidationError){
				const errorArray: error[] = [] 
				
				for (const [key, val] of Object.entries(err.errors)){
					const error: error = {};
					error[key] = val.message;
					errorArray.push(error)	
				}
				const appError = new AppError('ValidationError', 'Failed validation constraints', true);
				appError.setErrors(errorArray);
				throw appError;
			}
			throw new AppError('ServerError', 'exception occured in Auction model', false);
		}
	}

	async getAuctionById(auctionId: string) {
		const results = await asyncWrapper(Auction.findById(auctionId));
		if (results.error){
			console.log(results.error);
			throw new AppError('DatabaseError', 'Failure in db', false);
		}
		return results.data;
	}
	
}

const liveAuction = new LiveAuction();
export default liveAuction;