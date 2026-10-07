import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ROLES = ['user', 'uploader', 'moderator'] as const;
export type Role = (typeof ROLES)[number];

/** Moderators can do everything uploaders can. */
const RANK: Record<Role, number> = { user: 0, uploader: 1, moderator: 2 };
export const hasRole = (actual: Role, required: Role) => RANK[actual] >= RANK[required];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user' },
    emailVerified: { type: Boolean, default: false },
    // Only a hash of the verification token is stored, like a password.
    verifyTokenHash: { type: String, select: false },
    verifyExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ verifyTokenHash: 1 }, { sparse: true });

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

export function publicUser(u: UserDoc) {
  return { id: u.id as string, name: u.name, email: u.email, role: u.role, emailVerified: u.emailVerified };
}
