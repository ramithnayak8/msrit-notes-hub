import mongoose from 'mongoose';
import { GridFSBucket } from 'mongodb';
import { logger } from './lib/logger.js';

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}

/** The native driver handle, for things Mongoose doesn't wrap (search indexes, GridFS). */
export function nativeDb() {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database not connected');
  return db;
}

/** Uploaded PDFs live in GridFS so the whole system needs only one datastore. */
export function filesBucket() {
  return new GridFSBucket(nativeDb(), { bucketName: 'files' });
}
