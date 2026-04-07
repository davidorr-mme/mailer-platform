import { createClient } from 'redis';
import { env } from './env';

const redisClient = createClient({
  url: env.REDIS_URL,
});

redisClient.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisClient.on('connect', () => {
  console.log('Redis connected');
});

redisClient.connect().catch((err) => {
  console.error('Failed to connect to Redis:', err);
});

export default redisClient;
