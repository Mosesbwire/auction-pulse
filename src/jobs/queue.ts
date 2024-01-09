import Queue  from "bull";
import liveAuction from "../components/auction/auctionModel";

export const bidQueue = new Queue('bidProcessor', 'redis://127.0.0.1:6379');

bidQueue.process(liveAuction.updateAuctionBid);

bidQueue.on('completed', (job, result)=> {
    console.log(`JOB ID:${job.id} result:${result} completed`)
});

bidQueue.on('error', (err) => {
    console.log(`in error: ${err}`)
});

