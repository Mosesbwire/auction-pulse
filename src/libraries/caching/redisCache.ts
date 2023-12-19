
import { RedisClientType, createClient } from "redis";
import { asyncWrapper } from "../utils/asyncWrapper";
import AppError from "../error";


class Redis {
  client: RedisClientType;
  constructor(){
		this.client = createClient();
	}

	async connectRedis(){
		const results = await asyncWrapper(this.client.connect());
		if (results.error){
			throw new AppError(results.error.name, results.error.message, false);
		}
		console.log('Connected to redis server');
	}
	isAlive(){
		return this.client.isReady;
	}

	Client(){
		return this.client
	}
}

const RedisClient: Redis = new Redis();

export const redisClient = RedisClient.Client();
export default RedisClient;