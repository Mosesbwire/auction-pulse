/**
 * class used to create error objects
 */
import { Response } from "express";
import { HttpErrorCode } from "./constants";
import { error } from "./constants";

export default class AppError extends Error {
	public readonly name: string;
	public readonly statusCode: HttpErrorCode;
	public readonly isOperational: boolean;
	errors: error[] | []
	constructor(name: string, message: string, isOperational: boolean, statusCode?: HttpErrorCode) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype); // restore prototype chain

		this.name = name;
		this.statusCode = statusCode || 500;
		this.isOperational = isOperational;
		this.errors = [];
		Error.captureStackTrace(this);
	}

	setErrors(err: error[]){
		this.errors = err;
	}

}

/**
 * provides logic for handling error and responding to errors
 * @param error instance of app error that has occured
 * @param res 
 */
export async function errorHandler(error: AppError | Error, res?: Response): Promise<Response>{
	//error logging should be done here
	if (error instanceof AppError){
		if (error.isOperational && res) {
			console.log(error);
			return res.status(error.statusCode).json({error: {name: error.name, message: error.message, errors: error.errors}})
		} else if (error.name === 'DatabaseConnectionError'){
			console.log('retrying connection to db...')
			// we can retyr connecting before quitting
		}
	}
	if (error.name === 'MongooseServerSelectionError'){
		// we can retry connecting before ultimately quiting
		console.log('Connection error...')
	}
	console.log(error);
	console.log('Exiting....')
	//send alerts
	//restart application depending on error
	process.exit(1);
}
