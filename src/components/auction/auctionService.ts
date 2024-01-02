import { Server, Socket } from "socket.io";
import liveAuction from "./auctionModel";
import { redisClient } from "../../libraries/caching/redisCache";
import { asyncWrapper } from "../../libraries/utils/asyncWrapper";
import AppError, { errorHandler } from "../../libraries/error";
import Auction from "./auction";

/**
 *
 * service layer for the auction, interface to interact with other modules
 */
export default class AuctionService {
	io: Server;
	constructor(io: Server) {
		this.io = io;
	}

	async getAuctionById(auctionId: string){
		const results = await asyncWrapper(redisClient.get(`auction_${auctionId}`));
		if (results.error){
			throw new AppError(results.error.name, results.error.message, false);
		}
		if (results.data){
			return Auction.hydrate(JSON.parse(results.data))
		}
		const dbResults = await asyncWrapper(liveAuction.getAuctionById(auctionId));
		if (dbResults.error && dbResults.error instanceof AppError){
				throw new AppError(dbResults.error.name, dbResults.error.message, dbResults.error.isOperational);
		}
		if (dbResults.data) {
			await redisClient.set(`auction_${auctionId}`, JSON.stringify(dbResults.data))
			return Auction.hydrate(dbResults.data)
		}
	}

	hydrateDocument(auction: string){
		return Auction.hydrate(auction);
	}
	async initAuction(auctionId: string){
		const act = await redisClient.get(`auction_${auctionId}`);
		if (act){
			const auction = this.hydrateDocument(act);
			
		}
	}
	async runAuction(socket: Socket) {
		const auctionId: string | undefined | string[] = socket.handshake.query.id;
		const results = await asyncWrapper(this.getAuctionById(String(auctionId)));
		if (results.error){
			return socket.emit('appError', 'Server error. Try later')
		}
		if (results.data === undefined){
			return socket.emit('appError', 'Auction does not exist');
		}

		const auction = results.data;
		if (auction.status === 'closed'){
			return socket.emit('appError', 'This auction is closed');
		}
		if (auction.status === 'pending') {
			return socket.emit('appError', `This auction will start on: ${auction.startDate}`);
		}
		if (!socket.handshake.headers.user){
			return socket.emit('appError', 'Client Error. user header missing')
		}
		const user = socket.handshake.headers.user;
		await redisClient.set(`auction:${auction.id}:${user}`, String(user));
		await redisClient.set(`auction:${auction.id}:${user}:sessionId`, socket.id);
		await redisClient.set(`auction:${auction.id}:status`, auction.status);
		await redisClient.set(`auction:${auction.id}:timer`, auction.timer);
		await redisClient.set(`auction:${auction.id}:bidIncrement`, auction.bidIncrement);
		if (auction.item){
			await redisClient.set(`auction:${auction.id}:reserve`, auction.item.reservePrice);
			await redisClient.set(`standing:bid:${auction.id}`, auction.item.reservePrice);
		}

		if (auctionId !== undefined){
			socket.join(auctionId);
			const bid = await redisClient.get(`standing:bid:${auctionId}`)
			socket.emit('welcome', `Welcome to the auction. Item: ${auction.item?.title}, Reserve price: ${auction.item?.reservePrice}\nBid Increments at ${auction.bidIncrement}, Bids expire after every: ${auction.timer} seconds\n Current bids start at ${bid}`);
		}
		
		const isTimer = await redisClient.get(`auctionTimer_${auctionId}`);
		
		if (!isTimer){
			await redisClient.set(`auctionTimer_${auctionId}`, 1);
			
			setInterval(async()=>{
				const endTime = await redisClient.get(`endtime_${auctionId}`)
				const status = await redisClient.get(`auction:${auctionId}:status`)
				if (endTime && Number(endTime) < Date.now() && status === 'open'){
					const highestBid = await redisClient.get(`standing:bid:${auctionId}`);
					await redisClient.set(`auction:${auctionId}:status`, 'closed');
					const currentAuction = await redisClient.get(`auction_${auctionId}`);
					const userId = await redisClient.get(`auction:${auction.id}:${user}`)
					if (currentAuction){
						const updateAuction = Auction.hydrate(JSON.parse(currentAuction));
						updateAuction.status = 'closed';
						updateAuction.winner = userId;
						await updateAuction.save();
					}
					const winner = await redisClient.get(`auction:${auctionId}:highest:bidder`);
					this.io.to(String(winner)).emit('update', 'You won the auction');
					return this.io.to(String(auctionId)).emit('closed', `Auction closed. Highest bid: ${highestBid}`);
					
				}

				if (endTime && status === 'open'){
					this.io.to(String(auctionId)).emit('countdown', await redisClient.ttl(`counter_${auctionId}`));
				}
			}, 1000);
		}
		
		
		socket.on('bid', async ()=> {
			const status = await redisClient.get(`auction:${auctionId}:status`)
			const bidIncrement = await redisClient.get(`auction:${auctionId}:bidIncrement`);
			const user = socket.handshake.headers.user;
			if (!user){
				return socket.emit('appError', 'Client error. user header missing')
			}
			if (status === 'closed'){
				return socket.emit('update', 'This auction has ended');
			}
			const standingBid = await redisClient.get(`standing:bid:${auctionId}`);
			const userSocketId = await redisClient.get(`auction:${auction.id}:${user}:sessionId`)
			await redisClient.set(`auction:${auctionId}:highest:bidder`, String(userSocketId));
			if (standingBid && bidIncrement){
				const newStandingBid = Number(standingBid) + Number(bidIncrement);
				this.io.to(String(auctionId)).emit('update', newStandingBid);
				await redisClient.set(`standing:bid:${auctionId}`, newStandingBid);
			}
			const timer = await redisClient.get(`auction:${auctionId}:timer`);
			const endTime = Date.now() + Number(timer) * 1000;
			await redisClient.set(`endtime_${auctionId}`,endTime.toString());
			await redisClient.setEx(`counter_${auctionId}`, Number(timer), endTime.toString());
			const currentAuction = await redisClient.get(`auction_${auctionId}`);
			if (currentAuction){
				const updateAuction = Auction.hydrate(JSON.parse(currentAuction));
				if (updateAuction.bids){
					updateAuction.bids.push(standingBid);
					await updateAuction.save();
				}
			}
		});

		socket.on('customBid', async (arg) => {
			const status = await redisClient.get(`auction:${auctionId}:status`)
			const user = socket.handshake.headers.user;
			if (status === 'closed'){
				return socket.emit('update', 'This auction has ended');
			}
			if (!user){
				return socket.emit('appError', 'Client error. user header missing')
			}
			const standingBid = await redisClient.get(`standing:bid:${auctionId}`);
			if (standingBid && arg && Number(standingBid) >= Number(arg)){
				return socket.emit('update', `Your bid of ${arg} should be higher than current standing bid of ${standingBid}`);
			}
			const userSocketId = await redisClient.get(`auction:${auction.id}:${user}:sessionId`)
			await redisClient.set(`auction:${auctionId}:highest:bidder`, String(userSocketId));
			await redisClient.set(`standing:bid:${auctionId}`, arg);
			const timer = await redisClient.get(`auction:${auctionId}:timer`);
			const endTime = Date.now() + Number(timer) * 1000;
			await redisClient.set(`endtime_${auctionId}`,endTime.toString());
			await redisClient.setEx(`counter_${auctionId}`, Number(timer), endTime.toString());
			const currentAuction = await redisClient.get(`auction_${auctionId}`);
			if (currentAuction){
				const updateAuction = Auction.hydrate(JSON.parse(currentAuction));
				if (updateAuction.bids){
					updateAuction.bids.push(standingBid);
					await updateAuction.save();
				}
			}
		});
	}

}

