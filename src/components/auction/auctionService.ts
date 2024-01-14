import { Server, Socket } from "socket.io";
import liveAuction from "./auctionModel";
import { redisClient } from "../../libraries/caching/redisCache";
import EventEmitter from "events";
import Auction from "./auction";
import jobQueue from "../../jobs/queue";
/**
 *
 * service layer for the auction, interface to interact with other modules
 * 
 */
class Timer extends EventEmitter{
	io: Server;

	constructor(io: Server){
		super();
		this.io = io;
	}

	async initTimer(auctionTimer: number, room: string){
		await redisClient.hSet(
			`auction:${room}:timer`,
			{
				endTime: 0,
				timedOut: 'false',
				timerOn: 'false',
				auctionTimer: auctionTimer
			}
		);
	}

	async startCountDown(room: string){
		const key = `auction:${room}:timer`;
		const timer = await redisClient.hGet(key, 'auctionTimer');
		const newEndTime = Date.now() + Number(timer) * 1000;
		await redisClient.hSet(key, 'endTime', newEndTime);
		await redisClient.setEx(`ttl:key:${room}`, Number(timer), String(newEndTime));	
	}

	clearTimer(timerId: string){
		clearInterval(timerId);
	}

	async isTimedOut(room: string){
		const key = `auction:${room}:timer`;
		const endTime = await redisClient.hGet(key, 'endTime');
		if (Number(endTime) !== 0 && Number(endTime) < Date.now()){
			await redisClient.hSet(key, 'timedOut', 'true');
			this.emit('timed out', room)
			const counterId = await redisClient.hGet(key, 'counterId');
			if (counterId) this.clearTimer(counterId);
			return true
		}
		return false
	}

	async isTimerOn(room: string){
		const key = `auction:${room}:timer`;
		const timerOn = await redisClient.hGet(key, 'timerOn');
		return timerOn === 'true';
	}
	
	async setTimerOn(room: string){
		const key = `auction:${room}:timer`;
		await redisClient.hSet(key, 'timerOn', 'true');
	}
	
	async countDown(room: string){
		const counterId = setInterval(async ()=> {
			const isTimedOut = await this.isTimedOut(room);
			if (!isTimedOut){
				this.io.to(room).emit('countdown', await redisClient.ttl(`ttl:key:${room}`));
			}
		}, 1000);
		await redisClient.hSet(`auction:${room}:timer`, 'counterId', String(counterId));
	}

	async clearCache(auctionId: string){
		await redisClient.del(`auction:${auctionId}:timer`);
	}

}








type auctionDataType = Awaited<ReturnType<typeof liveAuction.getAuctionById>>;
class AuctionProcess {
	timer: Timer;
	io: Server
	constructor(timer: Timer, io: Server){
		this.timer = timer;
		this.io = io;
	}

	static async isActivated(auctionId: string){
		const status = await redisClient.hGet(`auction:${auctionId}:process`, 'isActivated');
		return status === 'true';
	}
	async initAuctionProcess(auction: auctionDataType){
		if (auction && auction.item){
			await redisClient.hSet(
				`auction:${auction.id}:process`,
				{
					bidIncrement: auction.bidIncrement,
					standingBid: auction.item.reservePrice,
					status: auction.status,
					isActivated: 'true',
					highestBidder: ''
				}
			)
			this.timer.initTimer(auction.timer, auction.id);
			this.closeAuction();
		}
	}

	async setAuction(auction: auctionDataType) {
		await redisClient.set(`auction:${auction.id}`, JSON.stringify(auction));
	}

	async auction(auctionId: string) {
		const auction = await redisClient.get(`auction:${auctionId}`);
		if (auction) return Auction.hydrate(JSON.parse(auction));
	}
	async bidIncrement(auctionId: string){
		const amount = await redisClient.hGet(`auction:${auctionId}:process`, 'bidIncrement');
		return Number(amount);
	}

	async standingBid(auctionId: string){
		const amount = await redisClient.hGet(`auction:${auctionId}:process`, 'standingBid');
		return Number(amount);
	}

	async updateStandingBid(auctionId: string, bid: number){
		await redisClient.hSet(`auction:${auctionId}:process`, 'standingBid', bid);
	}

	async highestBidder(auctionId: string){
		const bidder = await redisClient.hGet(`auction:${auctionId}:process`, 'highestBidder');
		return bidder;
	}
	async updateHighestBidder(auctionId: string, userId: string) {
		await redisClient.hSet(`auction:${auctionId}:process`, 'highestBidder', userId)
	}

	async isOpen(auctionId: string){
		const open = await this.timer.isTimedOut(auctionId);
		return !open;
	}

	
	async startTimerIfNotOn(auctionId: string){
		const timerStatus = await this.timer.isTimerOn(auctionId);
		if (!timerStatus){
			this.timer.countDown(auctionId);
			await this.timer.setTimerOn(auctionId);
		}
	}

	async startCountDown(auctionId: string){
		this.timer.startCountDown(auctionId);
	}

	async addBidToQueue(auctionId: string, bid: number){
		
		jobQueue.add('bids', {id: auctionId, bid})
	}
	async updateAuction(auctionId: string, winner: string){
		jobQueue.add('close auction', {id: auctionId, winner})
	}

	async placeBid(auctionId: string){
		this.startTimerIfNotOn(auctionId);
		const currentBid = await this.bidIncrement(auctionId) + await this.standingBid(auctionId);
		await this.updateStandingBid(auctionId, currentBid);
		await this.addBidToQueue(auctionId, currentBid);
		return currentBid
	}

	async placeCustomBid(auctionId: string, amount: number){
		this.startTimerIfNotOn(auctionId);
		const standingBid = await this.standingBid(auctionId);
		if (standingBid > amount) return new Error(`Bid rejected: Bid of ${amount} is lower than current standing bid: ${standingBid}`);
		this.updateStandingBid(auctionId, amount);
		await this.addBidToQueue(auctionId, amount);
		return amount;
	}
	async clearCache(auctionId: string){
		await redisClient.del(`auction:${auctionId}:process`);
		await redisClient.del(`auction:${auctionId}`);
	}
	closeAuction(){
		this.timer.on('timed out', async (auctionId)=> {
			
			const standingBid = await this.standingBid(auctionId);
			this.io.to(auctionId).emit('close', `Auction has closed. Winning bid is Kshs.${standingBid}`);
			const winner = await this.highestBidder(auctionId);
			await this.updateAuction(auctionId, String(winner));
			this.clearCache(auctionId);
			this.timer.clearCache(auctionId);
			
		})
	}
}


















export class AuctionProcessFactory{
	static createProcess(io: Server){
		const timer = new Timer(io);
		
		return new AuctionProcess(timer, io);
	}
}


export default class AuctionService {
	io: Server;
	auctionProcess: AuctionProcess
	constructor(io: Server, auctionProcess: AuctionProcess) {
		this.io = io;
		this.auctionProcess = auctionProcess
	}
	async bid(auctionId: string){
		
		const bid = await this.auctionProcess.placeBid(auctionId);
		this.io.to(auctionId).emit('update', `Current standing bid is: ${bid}`);
		await this.auctionProcess.startCountDown(auctionId);
	}

	async customBid(auctionId: string, socket: Socket, amount: number){
		const results = await this.auctionProcess.placeCustomBid(auctionId, amount);
		if(results instanceof Error){
			return socket.emit('appError', results.message);
		}
		this.io.to(auctionId).emit('update', `Current standing bid is: ${results}`);
		await this.auctionProcess.startCountDown(auctionId);
	}

	async updateHighestBidder(auctionId: string, userId: string) {
		await this.auctionProcess.updateHighestBidder(auctionId, userId);
	}

	async takeBid(auctionId: string){
		
		return await this.auctionProcess.isOpen(auctionId);
	}

	async getAuction(auctionId: string){
		const auction = await this.auctionProcess.auction(auctionId);
		if (!auction) {
			const data = await liveAuction.getAuctionById(auctionId);
			if (data && data.status === 'open') await this.auctionProcess.setAuction(data);
			return data
		}
		return auction
	}

	async run(socket: Socket) {
		const auctionId = socket.handshake.query.id;
		
		const auction = await this.getAuction(String(auctionId));
		if (!auction) {
			
			return socket.emit('appError', 'Auction Not Found');
		}

		if (auction.status === 'closed'){
			
			return socket.emit('appError', 'This auction is closed');
		}
		if (auction.status === 'pending'){

			return socket.emit('appError', `This auction will start on ${auction.startDate}`);
		} 
		
		const isActivated = await AuctionProcess.isActivated(auction?.id);
		if (!isActivated){
			this.auctionProcess.initAuctionProcess(auction);
		}

		socket.join(String(auctionId));
		socket.emit('welcome', 'Welcome to the auction you can proceed to bid');
		
		socket.on('bid', async () => {
			console.log('bidding')
			const auctionId = String(socket.handshake.query.id);
			const userId = socket.handshake.auth.userId
			const takeBid = await this.takeBid(auctionId);
			if (!takeBid) return socket.emit('close', 'This auction has closed');
			await this.bid(auctionId);
			await this.updateHighestBidder(auctionId, userId);
		});
		socket.on('custom bid', async (arg)=> {
			const auctionId = String(socket.handshake.query.id);
			const userId = socket.handshake.auth.userId
			const takeBid = await this.takeBid(auctionId);
			if (!takeBid) return socket.emit('close', 'This auction has closed');
			await this.customBid(auctionId, socket, Number(arg));
			await this.updateHighestBidder(auctionId, userId);

		})

	}
}

