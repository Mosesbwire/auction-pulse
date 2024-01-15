import Queue, { Job }  from "bull";
import Auction from "../components/auction/auction";
import { asyncWrapper } from "../libraries/utils/asyncWrapper";


const REDIS_URL = process.env.NODE_ENV === 'PRODUCTION' ? process.env.REDIS_URL : process.env.REDIS_URL_DEV
console.log(REDIS_URL)
const jobQueue = new Queue(String(REDIS_URL));

async function updateAuctionBid(job: Job){
    const data = job.data
		const results = await asyncWrapper(Auction.findById(data.id));
		if (results.error) throw results.error;
		const auction = results.data;
		if (auction){
			auction.bids.push(data.bid);
			await auction.save();
		}
		return Promise.resolve(auction)
}

async function activateAuction(job: Job){
	const data = job.data
	const results = await asyncWrapper(Auction.findById(data.id))
	if (results.error) throw results.error;
	const auction = results.data;
	if (auction){
		auction.status = 'open';
		await auction.save()
	}
	return Promise.resolve(auction);
}

async function updateAuctionOnClose(job: Job) {
	
	const data = job.data
	
	const results = await asyncWrapper(Auction.findById(data.id))
	if (results.error) throw results.error;
	const auction = results.data;
	if (auction) {
		auction.status = 'closed';
		auction.winner = data.winner
		await auction.save()
	}
	return Promise.resolve(auction);
}

jobQueue.on('error', (err) => {
	console.log('An error occured in job queue: ' + err);
});

jobQueue.on('completed', (job, results) => {
	console.log(`JOB ID ${job.id} is compeleted. Data: ${results}`);
});

jobQueue.process('bids', updateAuctionBid);
jobQueue.process('activate auction', activateAuction);
jobQueue.process('close auction', updateAuctionOnClose);

export default jobQueue




