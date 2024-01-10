import jwt from 'jsonwebtoken';
import { Request } from 'express';
import strategy, { JwtFromRequestFunction } from 'passport-jwt';
import passport from 'passport';
import bcrypt from 'bcrypt';

import AppError from './error';
// import { asyncWrapper } from './utils/asyncWrapper';
// import auctioneer from '../components/auctioneers/auctioneerModel';
// import { Document } from 'mongoose';

const jwtStrategy = strategy.Strategy;
const extractJwt = strategy.ExtractJwt;

/**
	 * hashes a user's password
	 * @param textPassword user password in plain text
	 * @returns {string} returns a hashed password
	 */
export async function hashPassword(textPassword: string): Promise<string> {
	const ROUNDS = 10;
	const salt = await bcrypt.genSalt(ROUNDS);
	const password = await bcrypt.hash(textPassword, salt);
	return password
}
/**
 * checks if the password passed matches the saved password
 * @param textPassword 
 * @param hashedPassword 
 * @returns true if passwords match otherwise false
 */
export async function isCorrectPassword(textPassword: string, hashedPassword: string): Promise<boolean> {
	const isCorrect = await bcrypt.compare(textPassword, hashedPassword);
	return isCorrect
}

export async function generateAuthToken<T extends Buffer | string | object>(payload: T){
	const SECRET_KEY = process.env.SECRET_KEY;
	if (!SECRET_KEY){
		throw new AppError('ENVVARIABLEERR', 'missing environment variable \'SECRET_KEY\'', false)
	}

	return jwt.sign(payload, SECRET_KEY, {expiresIn: '1h',});
	
}


interface Ioptions {
	jwtFromRequest: JwtFromRequestFunction,
	ignoreExpiration: boolean,
	passReqToCallback: boolean,
	algorithms: string[],
	secretOrKey: string
}

interface Ipayload {
	id: string,
	name: string
}
type cb = (a: null | Error, payload: Ipayload) => void;
export function registerJWTstrategy(){

	const SECRET_KEY = process.env.SECRET_KEY;
	if (!SECRET_KEY){
		throw new AppError('ENVVARIABLEERR', 'missing environment variable \'SECRET_KEY\'', false)
	}

	const opts: Ioptions  = {
		jwtFromRequest: extractJwt.fromAuthHeaderAsBearerToken(),
		ignoreExpiration: false,
		passReqToCallback: true,
		algorithms: ['HS256', 'HS384', 'HS512'],
		secretOrKey: SECRET_KEY
	}
	
	passport.use(new jwtStrategy(opts, async (req: Request, payload: Ipayload, done: cb) => {
		req.params.user = payload.id
		done(null,payload )
	}));


}



