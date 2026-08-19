import { Queue } from 'bullmq';
import { env } from '../lib/env.js';

function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379'),
    password: parsed.password || undefined,
  };
}

export function createQueue(name: string) {
  return new Queue(name, {
    connection: parseRedisUrl(env.REDIS_URL()),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400,
        count: 1000,
      },
      removeOnFail: {
        age: 604800,
        count: 5000,
      },
    },
  });
}
