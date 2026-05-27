import { randomUUID } from "node:crypto";
import { getPostgresClient } from "./postgres.js";
import { getUserByEmail, insertUser } from "./users.js";
import { hashPassword } from "../marketer-pro/auth/password.js";
import type { UserRow } from "./users.js";

export type OAuthAccountRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: "google" | "apple";
  provider_id: string;
  provider_email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type SsoProfile = {
  provider: "google" | "apple";
  providerId: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
};

const COLS = `id, user_id, tenant_id, provider, provider_id, provider_email, display_name, avatar_url, created_at`;

/** Find an existing oauth_accounts row by provider + provider_id. */
export async function findOAuthAccount(
  provider: "google" | "apple",
  providerId: string,
): Promise<OAuthAccountRow | null> {
  const sql = getPostgresClient();
  if (!sql) return null;
  const rows = await sql<OAuthAccountRow[]>`
    SELECT ${sql.unsafe(COLS)} FROM oauth_accounts
    WHERE provider = ${provider} AND provider_id = ${providerId}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Find or create a user from an SSO profile.
 * Priority:
 *   1. Existing oauth_accounts row → return that user
 *   2. Existing user with the same email → link and return
 *   3. Create new user + workspace + oauth_accounts row
 *
 * Returns { user, tenantId, isNew }
 */
export async function findOrCreateSsoUser(profile: SsoProfile): Promise<{
  user: UserRow;
  tenantId: string;
  isNew: boolean;
} | null> {
  const sql = getPostgresClient();
  if (!sql) return null;

  // 1. Existing oauth_accounts row
  const existing = await findOAuthAccount(profile.provider, profile.providerId);
  if (existing) {
    const rows = await sql<UserRow[]>`
      SELECT id, tenant_id, email, password_hash, email_verified, role, created_at, updated_at
      FROM users WHERE id = ${existing.user_id} LIMIT 1
    `;
    const user = rows[0];
    if (user) return { user, tenantId: existing.tenant_id, isNew: false };
  }

  // 2. Existing user with same email → link the SSO provider
  const emailLower = profile.email.toLowerCase();
  const tenants = await sql<{ tenant_id: string }[]>`
    SELECT DISTINCT tenant_id FROM users WHERE email = ${emailLower} LIMIT 1
  `;
  const existingTenantId = tenants[0]?.tenant_id;
  if (existingTenantId) {
    const existingUser = await getUserByEmail(existingTenantId, emailLower);
    if (existingUser) {
      await linkOAuthAccount(existingUser.id, existingTenantId, profile);
      // Mark email verified since the provider already verified it
      await sql`UPDATE users SET email_verified = true, updated_at = now() WHERE id = ${existingUser.id}`;
      return { user: { ...existingUser, email_verified: true }, tenantId: existingTenantId, isNew: false };
    }
  }

  // 3. New user — auto-create workspace + user
  const tenantId = deriveTenantId(emailLower);
  const userId = randomUUID();
  // SSO users get a random unusable password hash — they can set one later
  const passwordHash = await hashPassword(randomUUID());
  const newUser = await insertUser({ id: userId, tenantId, email: emailLower, passwordHash, role: "member" });
  if (!newUser) return null;

  // Mark email verified immediately (provider confirmed it)
  await sql`UPDATE users SET email_verified = true, updated_at = now() WHERE id = ${userId}`;
  await linkOAuthAccount(userId, tenantId, profile);

  return { user: { ...newUser, email_verified: true }, tenantId, isNew: true };
}

async function linkOAuthAccount(userId: string, tenantId: string, profile: SsoProfile): Promise<void> {
  const sql = getPostgresClient();
  if (!sql) return;
  await sql`
    INSERT INTO oauth_accounts (user_id, tenant_id, provider, provider_id, provider_email, display_name, avatar_url)
    VALUES (
      ${userId}, ${tenantId}, ${profile.provider}, ${profile.providerId},
      ${profile.email.toLowerCase()},
      ${profile.displayName ?? null},
      ${profile.avatarUrl ?? null}
    )
    ON CONFLICT (provider, provider_id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      avatar_url   = EXCLUDED.avatar_url
  `;
}

/** Derive a deterministic tenant ID from an email address. */
function deriveTenantId(email: string): string {
  const prefix = email
    .split("@")[0]!
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 24);
  // Append 6 random chars to avoid collisions
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${suffix}`;
}
