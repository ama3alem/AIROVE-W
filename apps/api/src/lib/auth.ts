import { betterAuth } from 'better-auth';
import { env } from './env.js';

export const auth = betterAuth({
  database: {
    type: 'postgres',
    url: env.DATABASE_URL(),
  },
  secret: env.BETTER_AUTH_SECRET(),
  baseURL: env.BETTER_AUTH_URL(),
  emailAndPassword: {
    enabled: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
});
