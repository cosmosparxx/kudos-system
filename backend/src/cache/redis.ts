import { createClient } from 'redis';
import { config } from 'dotenv';
import logger from '../utils/logger.js';

config();

const client = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
  },
  password: process.env.REDIS_PASSWORD || undefined
});

client.on('error', (err) => logger.error('Redis error:', err));
client.on('connect', () => logger.info('Redis connected'));

export async function createRedisClient() {
  try {
    await client.connect();
    logger.info('Redis client initialized');
    return client;
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export function getRedisClient() {
  return client;
}

export async function setCacheWithTTL(key: string, value: any, ttlSeconds: number = 300) {
  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error('Redis set error:', error);
  }
}

export async function getCache(key: string) {
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
}

export async function deleteCache(key: string) {
  try {
    await client.del(key);
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
}

export async function deletePatternCache(pattern: string) {
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    logger.error('Redis pattern delete error:', error);
  }
}

export async function closeRedisClient() {
  await client.quit();
}
