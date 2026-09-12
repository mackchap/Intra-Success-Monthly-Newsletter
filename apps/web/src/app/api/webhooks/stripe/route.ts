import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { processStripeWebhookEvent } from "@/lib/billing/webhook-handlers";

// Needs the Node runtime (not Edge) for Stripe's signature verification, and
// must never be statically handled — it's a live inbound webhook endpoint.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret." }, { status: 400 });
  }

  const rawBody = await request.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, { status: 400 });
  }

  try {
    await processStripeWebhookEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`Failed to process Stripe webhook event ${event.id} (${event.type}):`, error);
    // 500 so Stripe retries — processStripeWebhookEvent's idempotency check
    // means a retry safely re-attempts only the work that didn't finish.
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
