import { z } from "zod";

export const UserRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  role: UserRoleSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const SignupBodySchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type SignupBody = z.infer<typeof SignupBodySchema>;

export const LoginBodySchema = z.object({
  tenantId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal("Bearer"),
});
export type AuthTokens = z.infer<typeof AuthTokensSchema>;

export const RefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof RefreshBodySchema>;

export const PasswordResetRequestBodySchema = z.object({
  email: z.string().email(),
  tenantId: z.string().min(1),
});

export const PasswordResetBodySchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  tid: z.string(),
  email: z.string(),
  role: UserRoleSchema,
  iat: z.number(),
  exp: z.number(),
});
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

export const AuthErrorCode = {
  INVALID_CREDENTIALS: "invalid_credentials",
  EMAIL_TAKEN: "email_taken",
  TOKEN_EXPIRED: "token_expired",
  TOKEN_INVALID: "token_invalid",
  RATE_LIMITED: "rate_limited",
  USER_NOT_FOUND: "user_not_found",
  WEAK_PASSWORD: "weak_password",
} as const;
export type AuthErrorCode = (typeof AuthErrorCode)[keyof typeof AuthErrorCode];
