export * from './schema/index.js';
import { db } from './db.js';
export { db };

export type Database = typeof db;
