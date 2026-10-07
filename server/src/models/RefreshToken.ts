import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One row per refresh token issued. Every login starts a new `family`; each
 * refresh revokes the presented token and issues its successor in the same
 * family. Presenting a token that was already revoked means it was copied, so
 * the whole family is revoked (reuse detection).
 */
const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedBy: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

// MongoDB deletes expired tokens on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof refreshTokenSchema>;
export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
