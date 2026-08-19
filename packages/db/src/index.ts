export * from './schema';
import { db } from './db';
export { db };

export type Database = typeof db;
