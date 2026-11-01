/**
 * Free database space by deleting the stored copy of every paper that has
 * finished ingestion and was imported with a source link (a Google Drive or
 * archive URL): its questions stay, and "Open PDF" then goes to that link.
 * Run after an ingestion batch, before the free tier's 512 MB fills up:
 *   npm run files:prune -w server [-- --dry-run]
 * Papers uploaded without a source link, and papers still in review, keep their file.
 */
import { config } from '../config.js';
import { connectDb, disconnectDb, filesBucket, nativeDb } from '../db.js';
import { SourceDocumentModel } from '../models/SourceDocument.js';
import { isWebUrl } from '../routes/documents.js';

const dryRun = process.argv.includes('--dry-run');
await connectDb(config.MONGODB_URI);

const docs = await SourceDocumentModel.find({ status: 'ready', fileStored: { $ne: false }, sourceUrl: { $regex: /^https?:\/\//i } })
  .select('title fileId sourceUrl')
  .lean();
const files = nativeDb().collection('files.files');
let freed = 0;
let pruned = 0;
for (const d of docs) {
  if (!isWebUrl(d.sourceUrl)) continue;
  const file = (await files.findOne({ _id: d.fileId }, { projection: { length: 1 } })) as { length: number } | null;
  if (!dryRun) {
    if (file) await filesBucket().delete(d.fileId);
    await SourceDocumentModel.updateOne({ _id: d._id }, { $set: { fileStored: false } });
  }
  freed += file?.length ?? 0;
  pruned++;
}
const kept = await SourceDocumentModel.countDocuments({ fileStored: { $ne: false } });
console.log(`${dryRun ? 'Would prune' : 'Pruned'} ${pruned} file(s), ${(freed / 1048576).toFixed(1)} MB. Documents with a stored copy now: ${kept}.`);
await disconnectDb();
