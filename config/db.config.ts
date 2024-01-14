import mongoose from 'mongoose';
import AppError from '../src/libraries/error';

/**
 * makes a connection to the database on application start up
 * @param url database url connetion string
 */
export default async function connectToDb(url: string): Promise<void> {
	try {
		await mongoose.connect(url);
		console.log('Connected to mongoDb');
	} catch (err) {
		
		throw new AppError('DatabaseConnectionError', 'Failed to connect to mongoDB', false);
	}
}