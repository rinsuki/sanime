import { default as Redis, type Redis as RedisType } from "ioredis"

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"

export const redis: RedisType = new Redis(REDIS_URL)
