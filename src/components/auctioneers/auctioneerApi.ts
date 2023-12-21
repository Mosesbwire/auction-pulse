import express, { Router } from 'express';
import { create, getProfile, login } from './auctioneerController';
import { validateSignUpData, validateLoginData } from '../../middleware/validation';
import passport from 'passport';

export const route:Router = express.Router();

route.post('/', validateSignUpData, create);
route.post('/login', validateLoginData, login);
route.get('/:id', passport.authenticate('jwt', {session: false}), getProfile);
