import { describe, expect, it } from "vitest";
import {
  findUsableConnectionsForNetwork,
  isConnectionUsable,
  listConnectedNetworks,
  needsReconnect,
  NETWORK_CAPABILITIES,
  PUBLISHABLE_NETWORKS,
  PublishableNetworkSchema,
  resolvePublishTarget,
  SocialConnectionSchema,
  type SocialConnection,
} from "./social-connections.js";

const baseConnection: SocialConnection = {
  connectionId: "conn-ig-1",
  workspaceId: "w1",
  network: "instagram",
  accountId: "ig-12345",
  accountHandle: "@brand",
  scopes: ["instagram_basic", "instagram_content_publish"],
  status: "active",
  connectedAt: "2026-04-01T00:00:00.000Z",
  expiresAt: "2026-08-01T00:00:00.000Z",
  connectedByUserId: "u1",
  accessTokenRef: "kms://prod/ig-12345",
};

describe("PublishableNetworkSchema", () => {
  it("accepts every documented publishable network", () => {
    for (const n of PUBLISHABLE_NETWORKS) {
      expect(PublishableNetworkSchema.safeParse(n).success).toBe(true);
    }
  });

  it("rejects export-only networks (email, web, print, podcast, generic)", () => {
    for (const n of ["email", "web", "print", "podcast", "generic"]) {
      expect(PublishableNetworkSchema.safeParse(n).success).toBe(false);
    }
  });
});

describe("NETWORK_CAPABILITIES", () => {
  it("has a frozen entry for every publishable network", () => {
    expect(Object.isFrozen(NETWORK_CAPABILITIES)).toBe(true);
    for (const n of PUBLISHABLE_NETWORKS) {
      expect(NETWORK_CAPABILITIES[n]).toBeDefined();
      expect(NETWORK_CAPABILITIES[n].network).toBe(n);
    }
  });

  it("flags Instagram and Snapchat as requiring business accounts", () => {
    expect(NETWORK_CAPABILITIES.instagram.requiresBusinessAccount).toBe(true);
    expect(NETWORK_CAPABILITIES.snapchat.requiresBusinessAccount).toBe(true);
    expect(NETWORK_CAPABILITIES.x.requiresBusinessAccount).toBe(false);
  });

  it("only allows scheduling on networks whose APIs support it", () => {
    expect(NETWORK_CAPABILITIES.facebook.canSchedule).toBe(true);
    expect(NETWORK_CAPABILITIES.instagram.canSchedule).toBe(true);
    expect(NETWORK_CAPABILITIES.reddit.canSchedule).toBe(false);
    expect(NETWORK_CAPABILITIES.discord.canSchedule).toBe(false);
  });
});

describe("SocialConnectionSchema", () => {
  it("accepts a minimal active connection", () => {
    expect(SocialConnectionSchema.safeParse(baseConnection).success).toBe(true);
  });

  it("rejects an unknown network value", () => {
    const bad = { ...baseConnection, network: "myspace" };
    expect(SocialConnectionSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing accountId / accountHandle", () => {
    const r1 = SocialConnectionSchema.safeParse({
      ...baseConnection,
      accountId: "",
    });
    const r2 = SocialConnectionSchema.safeParse({
      ...baseConnection,
      accountHandle: "",
    });
    expect(r1.success).toBe(false);
    expect(r2.success).toBe(false);
  });

  it("accepts non-expiring grants (expiresAt = null)", () => {
    const r = SocialConnectionSchema.safeParse({
      ...baseConnection,
      expiresAt: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("isConnectionUsable / needsReconnect", () => {
  it("treats only active connections as usable", () => {
    expect(isConnectionUsable({ ...baseConnection, status: "active" })).toBe(
      true,
    );
    expect(isConnectionUsable({ ...baseConnection, status: "expired" })).toBe(
      false,
    );
    expect(isConnectionUsable({ ...baseConnection, status: "revoked" })).toBe(
      false,
    );
    expect(isConnectionUsable({ ...baseConnection, status: "error" })).toBe(
      false,
    );
  });

  it("flags expired and revoked connections as needing reconnect", () => {
    expect(
      needsReconnect({ ...baseConnection, status: "expired" }),
    ).toBe(true);
    expect(
      needsReconnect({ ...baseConnection, status: "revoked" }),
    ).toBe(true);
    expect(needsReconnect({ ...baseConnection, status: "error" })).toBe(true);
  });

  it("flags active connections expiring inside the warning window", () => {
    const c: SocialConnection = {
      ...baseConnection,
      expiresAt: "2026-05-15T00:00:00.000Z",
    };
    const now = new Date("2026-05-10T00:00:00.000Z");
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(needsReconnect(c, now, sevenDays)).toBe(true);
    expect(needsReconnect(c, now, 0)).toBe(false);
  });

  it("does not flag connections without an expiry", () => {
    const c: SocialConnection = { ...baseConnection, expiresAt: null };
    expect(needsReconnect(c, new Date(), 99 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});

describe("findUsableConnectionsForNetwork / listConnectedNetworks", () => {
  const connections: SocialConnection[] = [
    baseConnection,
    {
      ...baseConnection,
      connectionId: "conn-ig-2",
      accountId: "ig-secondary",
      accountHandle: "@brand-second",
    },
    {
      ...baseConnection,
      connectionId: "conn-li-1",
      network: "linkedin",
      accountId: "li-co",
      accountHandle: "Brand Inc.",
    },
    {
      ...baseConnection,
      connectionId: "conn-x-expired",
      network: "x",
      accountId: "x-12",
      accountHandle: "@x_handle",
      status: "expired",
    },
  ];

  it("returns all usable connections for a network", () => {
    const ig = findUsableConnectionsForNetwork("instagram", connections);
    expect(ig.map((c) => c.connectionId)).toEqual(["conn-ig-1", "conn-ig-2"]);
  });

  it("excludes connections with non-active status from listConnectedNetworks", () => {
    const networks = listConnectedNetworks(connections);
    expect(networks).toEqual(["instagram", "linkedin"]);
  });
});

describe("resolvePublishTarget", () => {
  const connections: SocialConnection[] = [
    baseConnection,
    {
      ...baseConnection,
      connectionId: "conn-ig-2",
      accountId: "ig-secondary",
      accountHandle: "@brand-second",
    },
  ];

  it("returns the single usable connection when only one exists", () => {
    const single = [baseConnection];
    const r = resolvePublishTarget({ network: "instagram", connections: single });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.connection.connectionId).toBe("conn-ig-1");
  });

  it("requires accountId when more than one usable connection exists", () => {
    const r = resolvePublishTarget({ network: "instagram", connections });
    expect(r).toEqual({ ok: false, reason: "ambiguous_account_choice" });
  });

  it("returns the matching account when accountId is supplied", () => {
    const r = resolvePublishTarget({
      network: "instagram",
      connections,
      accountId: "ig-secondary",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.connection.connectionId).toBe("conn-ig-2");
  });

  it("rejects an unknown accountId for a network the workspace has connected", () => {
    const r = resolvePublishTarget({
      network: "instagram",
      connections,
      accountId: "ig-ghost",
    });
    expect(r).toEqual({ ok: false, reason: "unknown_account_id" });
  });

  it("returns no_connection_for_network when the workspace has no record on that network", () => {
    const r = resolvePublishTarget({ network: "tiktok", connections });
    expect(r).toEqual({ ok: false, reason: "no_connection_for_network" });
  });

  it("returns no_usable_connection_for_network when only expired/revoked connections exist", () => {
    const dead: SocialConnection[] = [
      { ...baseConnection, status: "expired" },
      { ...baseConnection, connectionId: "conn-ig-2", status: "revoked" },
    ];
    const r = resolvePublishTarget({ network: "instagram", connections: dead });
    expect(r).toEqual({ ok: false, reason: "no_usable_connection_for_network" });
  });
});
