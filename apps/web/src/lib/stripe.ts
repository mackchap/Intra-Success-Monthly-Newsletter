import Stripe from "stripe";

declare global {
  // eslint-disable-next-line no-var
  var __stripe: Stripe | undefined;
}

function createClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  const client = new Stripe(secretKey);
  if (process.env.NODE_ENV !== "production") {
    globalThis.__stripe = client;
  }
  return client;
}

// Constructed lazily on first use, not at import time — Next.js evaluates
// route modules during build-time page-data collection, when env vars from
// .env aren't loaded (see package.json's `dev`/`db:*` scripts vs. `build`).
// Importing this module must be safe even without STRIPE_SECRET_KEY set;
// only actually calling a Stripe method should require it.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = globalThis.__stripe ?? createClient();
    return Reflect.get(client, prop);
  },
});
