function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string, fallback: string = ''): string {
  return process.env[key] || fallback;
}

export const env = {
  DATABASE_URL: () => getEnv('DATABASE_URL'),
  REDIS_URL: () => getEnv('REDIS_URL'),
  BETTER_AUTH_SECRET: () => getEnv('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: () => getEnvOptional('BETTER_AUTH_URL', 'http://localhost:3001'),
  R2_ACCOUNT_ID: () => getEnv('R2_ACCOUNT_ID'),
  R2_ACCESS_KEY_ID: () => getEnv('R2_ACCESS_KEY_ID'),
  R2_SECRET_ACCESS_KEY: () => getEnv('R2_SECRET_ACCESS_KEY'),
  R2_BUCKET_NAME: () => getEnvOptional('R2_BUCKET_NAME', 'airove-production'),
  API_PORT: () => parseInt(getEnvOptional('API_PORT', '3001')),
  CORS_ORIGINS: () => getEnvOptional('CORS_ORIGINS', 'http://localhost:3000'),
  LOG_LEVEL: () => getEnvOptional('LOG_LEVEL', 'info'),
  NODE_ENV: () => getEnvOptional('NODE_ENV', 'development'),
};
