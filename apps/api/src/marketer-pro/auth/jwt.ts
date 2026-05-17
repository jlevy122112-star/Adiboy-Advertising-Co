import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { JwtPayload, UserRole } from "@home-link/marketer-pro-contract";

const ACCESS_TOKEN_TTL_S = 15 * 60;        // 15 minutes
const REFRESH_TOKEN_TTL_S = 7 * 24 * 3600; // 7 days

function getSecret(): Uint8Array {
  const key = process.env.MARKETER_JWT_SECRET?.trim();
  if (!key) throw new Error("MARKETER_JWT_SECRET is not set");
  return new TextEncoder().encode(key);
}

export async function signAccessToken(payload: Omit<JwtPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ tid: payload.tid, email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_S}s`)
    .sign(getSecret());
}

export async function signRefreshToken(userId: string, tenantId: string): Promise<string> {
  return new SignJWT({ tid: tenantId, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_S}s`)
    .sign(getSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      sub: payload.sub as string,
      tid: payload["tid"] as string,
      email: payload["email"] as string,
      role: payload["role"] as UserRole,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ userId: string; tenantId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if ((payload as JWTPayload & { type?: string })["type"] !== "refresh") return null;
    return { userId: payload.sub as string, tenantId: payload["tid"] as string };
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_TTL_S_EXPORT = ACCESS_TOKEN_TTL_S;
export const REFRESH_TOKEN_TTL_S_EXPORT = REFRESH_TOKEN_TTL_S;
