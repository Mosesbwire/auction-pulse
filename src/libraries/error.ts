/**
 * class used to create error objects
 */
import { Response } from "express";
import { HttpErrorCode } from "./constants";

export default class AppError extends Error {
	public readonly name: string;
	public readonly statusCode: HttpErrorCode;
	public readonly isOperational: boolean;
	errors: {[key: string]: string} | Record<string, never>;
	constructor(name: string, message: string, isOperational: boolean, statusCode?: HttpErrorCode) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain

		this.name = name;
		this.statusCode = statusCode || 500;
		this.isOperational = isOperational;
		this.errors = {};
		Error.captureStackTrace(this);
	}

	setErrors(err: {[key: string]: string}){
		this.errors = err;
	}

}

/**
 * provides logic for handling error and responding to errors
 * @param error instance of app error that has occured
 * @param res 
 */
export async function errorHandler(error: AppError | Error, res?: Response): Promise<void>{
	//error logging should be done here
	if (error instanceof AppError){
		if (error.isOperational && res) {
			res.status(error.statusCode).json({error: {name: error.name, message: error.message, errors: error.errors}})
		} else if (error.name === 'DatabaseConnectionError'){
			console.log('retrying connection to db...')
			// we can retyr connecting before quitting
		}
	}
	if (error.name === 'MongooseServerSelectionError'){
		// we can retry connecting before ultimately quiting
		console.log('Connection error...')
	}
	//send alerts
	//restart application depending on error
	process.exit(1);
}
