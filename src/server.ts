import express, {Response, Request, NextFunction} from 'express';
import dotenv from 'dotenv';
import connectToDb from '../config/db.config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import AppError, { errorHandler } from './libraries/error';

dotenv.config({
    path: process.env.NODE_ENV === 'production' ? '.env' : '.env.development.local'
});
const PORT = process.env.PORT || 3000; 
const DB_URL = process.env.MONGO_URL || ''
const app = express();
const server = createServer(app);
const io = new Server(server);
try {
    connectToDb(DB_URL)
} catch (err) {
    if (err instanceof AppError){
        errorHandler(new AppError(err.name, err.message, err.isOperational))
    }
}

app.use('/', (req, res) => {
    res.send('Api working');
});

io.on('connection', (socket) => {
    console.log('Connection established');
    socket.emit('signin','Welcome to the server');
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(async (err: AppError, req: Request, res: Response, next: NextFunction) => {
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
