import redis from "redis";

import { env } from "../../env.ts";

export const redisClient = redis.createClient({
  url: env.REDIS_URI,
});

redisClient.on("error", (err) => {
  console.error("Redis Error:", err);
});

async function initializeRedisClient() {
  if (redisClient.isOpen) {
    return redisClient;
  }

  await redisClient.connect();
  await redisClient.ping();

  console.log("Connected to redis");

  return redisClient;
}

export { initializeRedisClient };

export async function getVersion(
  userId: string,
  cacheName: string,
): Promise<string> {
  const versionKey = `${cacheName}:version:${userId}`;
  const version = await redisClient.get(versionKey);
  return version ?? "1";
}

export async function invalidateCache(
  userId: string,
  cacheName: string,
): Promise<void> {
  const versionKey = `${cacheName}:version:${userId}`;
  await redisClient.incr(versionKey);
}
