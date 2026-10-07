/**
 * Give a user a role (there is no admin UI for this yet):
 *   npm run user:role -w server -- someone@msrit.edu moderator [--verify]
 * --verify also marks the email verified, for local testing without SMTP.
 */
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { ROLES, UserModel, type Role } from '../models/User.js';

const [email, role] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!email || !ROLES.includes(role as Role)) {
  console.error(`Usage: set-role <email> <${ROLES.join('|')}> [--verify]`);
  process.exit(1);
}
await connectDb(config.MONGODB_URI);
const update: Record<string, unknown> = { role };
if (process.argv.includes('--verify')) update.emailVerified = true;
const user = await UserModel.findOneAndUpdate({ email: email.toLowerCase() }, { $set: update }, { returnDocument: 'after' });
console.log(user ? `${user.email} is now ${user.role}${user.emailVerified ? ' (verified)' : ''}` : `No user with email ${email}`);
await disconnectDb();
