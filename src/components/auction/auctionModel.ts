/**
 * represents the auction object
 */
import Auction  from "./auction";
import mongoose, { ObjectId } from 'mongoose';
import AppError from "../../libraries/error";
import { error } from "../../libraries/constants";
import { asyncWrapper } from "../../libraries/utils/asyncWrapper";
import jobQueue from "../../jobs/queue";

interface IAuction {
	auctioneer: ObjectId,
	startDate: string,
	start: boolean,
	bidIncrement: number,
	timer: number
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
			const data = {
				auctioneer: auctionData.auctioneer,
				startDate: new Date(auctionData.startDate),
				bidIncrement: auctionData.bidIncrement,
				name: auctionData.name,
				timer: auctionData.timer,
				status: 'pending'
			}

			if (!this.isValidStartDate(auctionData.start, new Date(auctionData.startDate))) throw new AppError('ClientError', 'Invalid Date', true, 401);

			if (auctionData.start) {
				data.startDate = new Date(Date.now());
				data.status = 'open';
			}
			
			let auction = new Auction({ ...data, item: itemData });
			auction = await auction.save();
			if (auction.status === 'pending'){

				const timeTillActivateAuction = auction.startDate.getTime() - Date.now();
				jobQueue.add('activate auction', {id: auction.id}, {delay: timeTillActivateAuction});
			}
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
			if (err instanceof AppError) throw err;
			throw new AppError('ServerError', 'exception occured in Auction model', false);
		}
	}
	isValidStartDate(start: boolean, date: Date){
		const now = new Date(Date.now());
		if (!start && now > date) return false
		if (!start && now < date) return true
		return start
	}

	
	async getAuctions(userId: string){
		const results = await asyncWrapper(Auction.find({}));
		console.log(userId)
		if (results.error){
			throw new AppError('DatabaseError', 'Failure in db', false)
		}
		return results.data
	}
	async getAuctionById(auctionId: string) {
		
		const results = await asyncWrapper(Auction.findById(auctionId));
		if (results.error){
			throw new AppError('DatabaseError', 'Failure in db', false);
		}
		if (!results.data) throw new AppError('DocumentNotFoundError', 'Document with associated id does not exist', true);
		return results.data;
	}

	async update(auctionId: string, auctionData: IAuction, itemData: Item){
		const results = await asyncWrapper(this.getAuctionById(auctionId))
		if (results.error) throw results.error
		const auction = results.data
		if (auction?.status === 'open') throw new AppError('IllegalOperation', 'An auction cannot be updated when it is open', true);
		const data = {...auctionData, ...itemData}
		const response = await Auction.updateOne({_id: auctionId}, data, {new: true});
		
		const isAcknowledged = response.acknowledged
		if (!isAcknowledged) return 'Failed to update document'

		return await this.getAuctionById(auctionId);
		
	}

	async delete(auctionId: string) {
		
		const results = await asyncWrapper(this.getAuctionById(auctionId))
		if (results.error) throw results.error
		const auction = results.data
		
		if (auction?.status === 'open') throw new AppError('IllegalOperation', 'An open auction cannot be deleted when it is still open', true);
		const data  = await Auction.deleteOne({_id: auctionId});
		
		if (data.deletedCount === 0) return 'Failed to delete document'
		return 'Document deleted'
		
	}
	
}

const liveAuction = new LiveAuction();
export default liveAuction;