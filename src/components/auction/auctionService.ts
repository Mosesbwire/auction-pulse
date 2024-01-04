import { Server, Socket } from "socket.io";
import liveAuction from "./auctionModel";
import { redisClient } from "../../libraries/caching/redisCache";

/**
 *
 * service layer for the auction, interface to interact with other modules
 * 
 */

class Bid {
	bidAmount: number;
	msg = '';
	standingBid: number

	constructor(bid: number, standingBid: number){
		this.bidAmount = bid;
		this.standingBid = standingBid
	}

	isValid(){
		if (this.bidAmount < this.standingBid){
			this.msg = 'Invalid: Bid should be higher or equal to current standing bid'
			return false
		}
		this.msg = 'Valid Bid'
		return true
	}
	getBidMsg(){
		return this.msg
	}

	process(){
		// add this bid to the job queue
	}

}

class Timer {
	io: Server;

	constructor(io: Server){
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
		if (Number(endTime) < Date.now()){
			await redisClient.hSet(key, 'timedOut', 'true');
			const counterId = await redisClient.hGet(key, 'counterId')
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

}

type auctionDataType = Awaited<ReturnType<typeof liveAuction.getAuctionById>>;
class AuctionProcess {
	timer: Timer;

	constructor(timer: Timer){
		this.timer = timer;
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
					isActivated: 'true'
				}
			)
			this.timer.initTimer(auction.timer, auction.id);
		}
	}

	// add function to update standing bid

	async bidIncrement(auctionId: string){
		const amount = await redisClient.hGet(`auction:${auctionId}:process`, 'bidIncrement');
		return Number(amount);
	}

	async standingBid(auctionId: string){
		const amount = await redisClient.hGet(`auction:${auctionId}:process`, 'standingBid');
		return Number(amount);
	}

	async isActive(auctionId: string){
		return await this.timer.isTimedOut(auctionId);
	}


	async close(auctionId: string){
		await redisClient.hSet(`auction:${auctionId}:process`, 'status', 'closed');
	}

	async placeBid(auctionId: string, bid: Bid){
		const timerStatus = await this.timer.isTimerOn(auctionId);
		if (!timerStatus && bid.isValid()){
			this.timer.countDown(auctionId);
			await this.timer.setTimerOn(auctionId);
		}
		
		if (bid.isValid()){
			await this.timer.startCountDown(auctionId);
			return bid.bidAmount;
		}
	}
}

export class AuctionProcessFactory{
	static createProcess(io: Server){
		const timer = new Timer(io);
		return new AuctionProcess(timer);
	}
}


export default class AuctionService {
	io: Server;
	auctionProcess: AuctionProcess
	constructor(io: Server, auctionProcess: AuctionProcess) {
		this.io = io;
		this.auctionProcess = auctionProcess
	}

	async run(socket: Socket) {
		const auctionId: string | undefined | string[] = socket.handshake.query.id;

		const auction = await liveAuction.getAuctionById(String(auctionId));
		
		const isActivated = await AuctionProcess.isActivated(auction?.id);

		if (!isActivated){
			this.auctionProcess.initAuctionProcess(auction);
		}

		socket.join(String(auctionId));
		socket.emit('welcome', 'Welcome to the auction you can proceed to bid')
		
		socket.on('bid', async () => {
			console.log('bidding');
			const auctionId = String(socket.handshake.query.id);
			const standingBid = await this.auctionProcess.standingBid(auctionId)
			const bid = new Bid(20000, Number(standingBid));
			this.auctionProcess.placeBid(String(socket.handshake.query.id), bid);
		})
	}
}

