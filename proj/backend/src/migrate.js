// Adds missing tables/columns to an EXISTING (or empty) database without deleting any data.
// Safe to run more than once.  Usage: npm run migrate
import { runMigrations } from './bootstrap.js';

runMigrations();
console.log('Migration done.');
