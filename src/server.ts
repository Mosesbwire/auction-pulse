import express, {Response, Request, NextFunction} from 'express';
import dotenv from 'dotenv';
import connectToDb from '../config/db.config';
import RedisClient from './libraries/caching/redisCache';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import AppError, { errorHandler } from './libraries/error';
import { auctioneerApi } from './components/auctioneers'
import { auctionApi } from './components/auction';
import AuctionService from './components/auction/auctionService';

dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env' : '.env.development.local'
});
const PORT = process.env.PORT || 3000; 
const DB_URL = process.env.MONGO_URL || ''
const app = express();
const server = createServer(app);
const io:Server = new Server(server);

RedisClient.connectRedis();
try {
    connectToDb(DB_URL)
} catch (err) {
    if (err instanceof AppError){
        errorHandler(new AppError(err.name, err.message, err.isOperational))
    }
}

app.use(express.json());
app.use(express.urlencoded({ extended: false}));

app.get('/', (_req, res) => {
    res.send('Api working');
});


app.use('/api/v1/auctioneers', auctioneerApi);
app.use('/api/v1/auctions', auctionApi);

const onConnection = async (socket: Socket) => {
    new AuctionService(io).runAuction(socket);
}
io.on('connection', onConnection);

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(async (err: AppError, _req: Request, res: Response, _next: NextFunction) => {
    await errorHandler(err, res);
})

process.on('uncaughtException', (err) => {
    
    if (err instanceof Error){
        errorHandler(err);
    }
})
process.on('unhandledRejection', (reason) =>{
    
    if (reason instanceof Error){
        errorHandler(reason);
    }
})


server.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
