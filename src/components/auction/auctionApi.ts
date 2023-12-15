import express from 'express';
import { createLiveAuction } from './auctionController';

export const route = express.Router();

/**
 * api/v1/post
 * creates new resource
 */
route.post('/', createLiveAuction);