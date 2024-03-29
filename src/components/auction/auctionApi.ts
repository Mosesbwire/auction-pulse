import express from 'express';
import { createLiveAuction, renderDashboard, getAuctions, getAuctionById, updateAuction, deleteAuction } from './auctionController';
import passport from 'passport';
export const route = express.Router();

/**
 * api/v1/auction
 * creates new resource
 */
route.post('/', passport.authenticate('jwt', {session: false}),createLiveAuction);
route.get('/dashboard', renderDashboard);
route.put('/:auctionId', passport.authenticate('jwt', {session: false}), updateAuction);
route.get('/:auctionId', passport.authenticate('jwt', {session: false}), getAuctionById);
route.get('/:auctionId', passport.authenticate('jwt', {session: false}), getAuctionById);

route.delete('/:auctionId', passport.authenticate('jwt', {session: false}), deleteAuction);
route.get('/', passport.authenticate('jwt', {session: false}), getAuctions);
