import { Server, Socket } from "socket.io";
import liveAuction from "./auctionModel";
import { redisClient } from "../../libraries/caching/redisCache";

/**
 *
 * service layer for the auction, interface to interact with other modules
 * 
 */



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
	async updateStandingBid(auctionId: string, bid: number){
		await redisClient.hSet(`auction:${auctionId}:process`, 'standingBid', bid);
	}
	async isActive(auctionId: string){
		return await this.timer.isTimedOut(auctionId);
	}

	async close(auctionId: string){
		await redisClient.hSet(`auction:${auctionId}:process`, 'status', 'closed');
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
	async placeBid(auctionId: string){
		this.startTimerIfNotOn(auctionId);
		const currentBid = await this.bidIncrement(auctionId) + await this.standingBid(auctionId);
		this.updateStandingBid(auctionId, currentBid);
		return currentBid
	}

	async placeCustomBid(auctionId: string, amount: number){
		this.startTimerIfNotOn(auctionId);
		const standingBid = await this.standingBid(auctionId);
		if (standingBid > amount) return new Error(`Bid rejected: Bid of ${amount} is lower than current standing bid: ${standingBid}`);
		this.updateStandingBid(auctionId, amount);
		return amount;
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
	async run(socket: Socket) {
		const auctionId: string | undefined | string[] = socket.handshake.query.id;

		const auction = await liveAuction.getAuctionById(String(auctionId));
		
		const isActivated = await AuctionProcess.isActivated(auction?.id);

		if (!isActivated){
			this.auctionProcess.initAuctionProcess(auction);
		}

		socket.join(String(auctionId));
		socket.emit('welcome', 'Welcome to the auction you can proceed to bid');
		
		socket.on('bid', async () => {
			const auctionId = String(socket.handshake.query.id);
			await this.bid(auctionId);
		});
		socket.on('custom bid', async (arg)=> {
			const auctionId = String(socket.handshake.query.id);
			await this.customBid(auctionId, socket, Number(arg));
		})
	}
}

