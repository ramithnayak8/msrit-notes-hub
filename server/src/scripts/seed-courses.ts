/**
 * Load official schemes of teaching (server/data/schemes/*.json) into the
 * course catalogue. Safe to re-run: courses are upserted by code + scheme.
 *
 *   npm run seed:courses -w server
 */
import { readdir, readFile } from 'node:fs/promises';
import { config } from '../config.js';
import { connectDb, disconnectDb } from '../db.js';
import { CourseModel } from '../models/Course.js';

type SchemeFile = {
  program: string;
  scheme: string;
  semester: number;
  source?: string;
  courses: { code: string; title: string; department?: string; category?: string; credits?: Record<string, number> }[];
};

const dir = new URL('../../data/schemes/', import.meta.url);
await connectDb(config.MONGODB_URI);
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.json'))) {
  const s: SchemeFile = JSON.parse(await readFile(new URL(file, dir), 'utf8'));
  const ops = s.courses.map((c) => ({
    updateOne: {
      filter: { code: c.code.toUpperCase(), scheme: s.scheme, program: s.program },
      update: { $set: { ...c, code: c.code.toUpperCase(), scheme: s.scheme, program: s.program, semester: s.semester, source: s.source } },
      upsert: true,
    },
  }));
  const r = await CourseModel.bulkWrite(ops);
  console.log(`${file}: ${r.upsertedCount} added, ${r.modifiedCount} updated`);
}
await disconnectDb();
