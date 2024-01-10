/** class representing an Auctioneer enables interaction with the database layer*/
import mongoose from 'mongoose';
import { Auctioneer as User } from './auctioneer'
import AppError from '../../libraries/error';
import { asyncWrapper } from '../../libraries/utils/asyncWrapper';
import { error } from '../../libraries/constants';


interface UserData {
	firstName: string,
	lastName: string,
	email: string,
	password: string,
	
}
class Auctioneer {
	/**
	 * creates an auctioneer
	 * @param {UserData} userData - Data needed to create the Auctioneer
	 * @return {Document} returns a Promise that resolves to the saved Document
	 */
	async create(userData:UserData){
		try {
			let user = new User(userData);
			
			user = await user.save();
			return user;
		} catch (err){
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
			throw new AppError('ServerError', 'exception occured in Auctioneer model', false);
		}
	}
	/**
	 * fetches user with given email from database
	 * @param {string} email - user email used as search parameter
	 * 
	 */
	async getAuctioneerByEmail(email: string){
		const results = await asyncWrapper(User.findOne({ email }));
		if (results.error){
			throw new AppError('DatabaseConnectionError', 'Error fetching document', false);
		}
		if (results.data === null){
			throw new AppError('DocumentNotFoundError', 'User not found', true)
		}
		return results.data;
	}
	/**
	 * Fetches user with given id from storage
	 * @param id user id
	 * @returns user document
	 */
	async getAuctioneerById(id: string) {
		const results = await asyncWrapper(User.findById(id));
		if (results.error instanceof mongoose.Error.CastError){
			throw new AppError('InvalidIdType', `Failed to cast id: ${id} to ObjectId type  `, true);
		}
		if (results.data === null){
			throw new AppError('DocumentNotFoundError', 'User not found', true)
		}
		if (results.error){
			throw new AppError('DatabaseConnectionError', 'Error ocuured in the database layer', false);
		}
		return results.data;
	}
}

const auctioneer = new Auctioneer();
export default auctioneer;