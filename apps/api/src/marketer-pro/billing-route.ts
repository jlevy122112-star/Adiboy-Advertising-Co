/**
 * Stripe billing routes:
 *   POST /billing/checkout  — create a Stripe Checkout Session (returns { url })
 *   POST /billing/portal    — create a Stripe Customer Portal session (returns { url })
 *   POST /billing/webhook   — Stripe webhook handler (raw body, no auth)
 *   GET  /billing/status    — current plan for authenticated user
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import Stripe from "stripe";
import { requireAuth, securityHeaders } from "./auth/middleware.js";
import {
  getWorkspaceBilling,
  getWorkspacePlan,
  setWorkspacePlan,
  upsertWorkspaceBilling,
  type PlanTier,
} from "../db/workspace-billing.js";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const APP_URL = process.env.APP_URL ?? "http://localhost:5173";

const PRICE_IDS: Record<string, { plan: PlanTier }> = {
  [process.env.STRIPE_PRICE_PRO_MONTHLY   ?? "price_pro_monthly"]:    { plan: "pro" },
  [process.env.STRIPE_PRICE_PRO_ANNUAL    ?? "price_pro_annual"]:     { plan: "pro" },
  [process.env.STRIPE_PRICE_ENT_MONTHLY   ?? "price_ent_monthly"]:    { plan: "enterprise" },
  [process.env.STRIPE_PRICE_ENT_ANNUAL    ?? "price_ent_annual"]:     { plan: "enterprise" },
};

function getStripe(): Stripe | null {
  if (!STRIPE_SECRET) return null;
  return new Stripe(STRIPE_SECRET, { apiVersion: "2026-04-22.dahlia" });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function cors(res: ServerResponse): void {
  const origin = process.env.BILLING_CORS ?? process.env.APP_URL ?? "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleCheckout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: "billing_not_configured" });

  const raw = await readBody(req);
  const body = JSON.parse(raw.toString("utf8") || "{}") as { priceId?: string; plan?: string; annual?: boolean };

  const isEnterprise = body.plan === "enterprise";
  const priceId = body.priceId ?? (
    isEnterprise
      ? (body.annual ? (process.env.STRIPE_PRICE_ENT_ANNUAL ?? "price_ent_annual") : (process.env.STRIPE_PRICE_ENT_MONTHLY ?? "price_ent_monthly"))
      : (body.annual ? (process.env.STRIPE_PRICE_PRO_ANNUAL ?? "price_pro_annual")  : (process.env.STRIPE_PRICE_PRO_MONTHLY ?? "price_pro_monthly"))
  );

  const billing = await getWorkspaceBilling(auth.tenantId);
  const customerId = billing?.stripe_customer_id ?? undefined;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer: customerId,
    customer_email: customerId ? undefined : auth.email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/#/billing-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${APP_URL}/#pricing`,
    metadata: { tenantId: auth.tenantId, userId: auth.userId },
    subscription_data: { metadata: { tenantId: auth.tenantId } },
    allow_promotion_codes: true,
  });

  json(res, 200, { url: session.url });
}

async function handlePortal(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = await requireAuth(req, res);
  if (!auth) return;

  const stripe = getStripe();
  if (!stripe) return json(res, 503, { error: "billing_not_configured" });

  const billing = await getWorkspaceBilling(auth.tenantId);
  if (!billing?.stripe_customer_id) return json(res, 400, { error: "no_subscription" });

  const session = await stripe.billingPortal.sessions.create({
    customer: billing.stripe_customer_id,
    return_url: `${APP_URL}/#pricing`,
  });

  json(res, 200, { url: session.url });
}

async function handleStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const auth = await requireAuth(req, res);
  if (!auth) return;
  const plan = await getWorkspacePlan(auth.tenantId);
  json(res, 200, { plan });
}

async function handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return json(res, 200, { received: true });
  }

  const rawBody = await readBody(req);
  const sig = req.headers["stripe-signature"] as string | undefined;
  if (!sig) return json(res, 400, { error: "missing_signature" });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch {
    return json(res, 400, { error: "invalid_signature" });
  }

  try {
    await dispatchWebhookEvent(stripe, event);
  } catch (err) {
    console.error("[billing-webhook] dispatch error", err);
  }

  json(res, 200, { received: true });
}

async function dispatchWebhookEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      if (!tenantId || session.mode !== "subscription") break;

      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id;

      let plan: PlanTier = "pro";
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["items.data.price"] });
        const priceId = sub.items.data[0]?.price.id ?? "";
        plan = PRICE_IDS[priceId]?.plan ?? "pro";
        // Stripe v22 removed current_period_end; use cancel_at or 30 days from now
        const expiresAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : new Date(Date.now() + 30 * 86400_000);
        await setWorkspacePlan(tenantId, plan, subscriptionId, expiresAt);
      }

      if (customerId) {
        await upsertWorkspaceBilling(tenantId, { stripe_customer_id: customerId });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;

      const priceId = sub.items.data[0]?.price.id ?? "";
      const plan: PlanTier = PRICE_IDS[priceId]?.plan ?? "pro";
      const active = sub.status === "active" || sub.status === "trialing";
      // Stripe v22: use cancel_at or compute 30d window
      const expiresAt = sub.cancel_at ? new Date(sub.cancel_at * 1000) : new Date(Date.now() + 30 * 86400_000);
      await setWorkspacePlan(tenantId, active ? plan : "free", sub.id, active ? expiresAt : undefined);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const tenantId = sub.metadata?.tenantId;
      if (!tenantId) break;
      await setWorkspacePlan(tenantId, "free");
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      // Stripe v22: subscription moved to parent.subscription_details.subscription
      const subRef = inv.parent?.subscription_details?.subscription;
      const subId = typeof subRef === "string" ? subRef : (subRef as { id?: string } | null)?.id;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      const tenantId = sub.metadata?.tenantId;
      if (tenantId && sub.status === "past_due") {
        await setWorkspacePlan(tenantId, "free");
      }
      break;
    }
  }
}

export async function handleBillingRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  securityHeaders(res);
  cors(res);

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = req.url?.split("?")[0] ?? "";

  if (req.method === "POST" && url === "/billing/checkout") return handleCheckout(req, res);
  if (req.method === "POST" && url === "/billing/portal")   return handlePortal(req, res);
  if (req.method === "POST" && url === "/billing/webhook")  return handleWebhook(req, res);
  if (req.method === "GET"  && url === "/billing/status")   return handleStatus(req, res);

  json(res, 404, { error: "not_found" });
}
