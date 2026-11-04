// Adds the demo users and data, but ONLY to a completely empty database. It never drops or deletes anything.
// Usage: npm run seed
import { runMigrations, seedDemoIfEmpty } from './bootstrap.js';

runMigrations();
seedDemoIfEmpty({ force: true });
console.log('Demo logins (if the data was added): admin@vehicleflow.com / Admin@123, ravi@vehicleflow.com / Mech@1234, priya@example.com / Cust@1234');
