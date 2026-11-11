/**
 * Set a new password for an account (there is no "forgot password" flow yet):
 *   npm run user:password -w server -- someone@msrit.edu
 * Asks for the password without echoing it, and signs the account out everywhere.
 */
import argon2 from 'argon2';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { RefreshTokenModel } from '../models/RefreshToken.js';
import { UserModel } from '../models/User.js';

const email = process.argv.slice(2).find((a) => !a.startsWith('--'));
if (!email) {
  console.error('Usage: set-password <email>');
  process.exit(1);
}

/** Reads one line from the terminal without showing what is typed. */
function askHidden(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch: string) => {
      for (const c of ch) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode?.(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(value);
        }
        if (c === '\u0003') process.exit(130); // Ctrl+C
        if (c === '\u007f' || c === '\b') value = value.slice(0, -1);
        else value += c;
      }
    };
    stdin.on('data', onData);
  });
}

await connectDb(config.MONGODB_URI);
const user = await UserModel.findOne({ email: email.toLowerCase() });
if (!user) {
  console.log(`No user with email ${email}`);
} else {
  const password = await askHidden('New password: ');
  const again = await askHidden('Again: ');
  // Same rule as registration.
  if (password.length < 8 || password.length > 128) console.log('Password must be 8 to 128 characters; nothing changed.');
  else if (password !== again) console.log('The two passwords differ; nothing changed.');
  else {
    user.passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await user.save();
    await RefreshTokenModel.deleteMany({ userId: user._id });
    console.log(`Password changed for ${user.email}; signed out of other sessions.`);
  }
}
await disconnectDb();
