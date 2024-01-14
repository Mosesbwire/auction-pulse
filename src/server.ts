import express, {Response, Request, NextFunction} from 'express';
import dotenv from 'dotenv';
import path from 'path';
import connectToDb from '../config/db.config';
import RedisClient from './libraries/caching/redisCache';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import AppError, { errorHandler } from './libraries/error';
import { auctioneerApi } from './components/auctioneers'
import { auctionApi } from './components/auction';
import { AuctionProcessFactory } from './components/auction/auctionService';
import { registerJWTstrategy } from './libraries/authentication';


import AuctionService from './components/auction/auctionService';
import passport from 'passport';

dotenv.config({
    path: process.env.NODE_ENV === 'PRODUCTION' ? '.env' : '.env.development.local'
});
const PORT = process.env.PORT || 3000; 
const DB_URL = process.env.MONGO_URL || ''

const SECRET_KEY = process.env.SECRET_KEY || ''
const app = express();
const server = createServer(app);
const io:Server = new Server(server, {
    cors: {
        origin: "*"
    }
});

RedisClient.connectRedis();
try {
    connectToDb(DB_URL)
} catch (err) {
    if (err instanceof AppError){
        errorHandler(new AppError(err.name, err.message, err.isOperational))
    }
}

// todo - dotenv configuration setting environment variables should happen first. 
//create config file export when dotenv is initialized

registerJWTstrategy(SECRET_KEY);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false}));
app.use(passport.initialize());
app.get('/', (_req, res) => {
    res.send('Api working');
});

app.get('/api/docs', (_req, res) => {
    res.render('docs')
})


app.use('/api/v1/auctioneers', auctioneerApi);
app.use('/api/v1/auctions', auctionApi);

const auctionProcess = AuctionProcessFactory.createProcess(io);
const auctionService = new AuctionService(io, auctionProcess);

const onConnection = async (socket: Socket) => {
    auctionService.run(socket);
}

io.use((socket, next) => {
    const token = socket.handshake.auth.userId;
    if (!token){
				const err = new Error('UnauthorisedAccess');
        next(err);
    } 
        
    next()
});

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
