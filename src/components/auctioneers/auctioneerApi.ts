import express, { Router } from 'express';
import { create } from './auctioneerController';
import { validateSignUpData } from '../../middleware/validation';

export const route:Router = express.Router();

route.post('/', validateSignUpData, create);
