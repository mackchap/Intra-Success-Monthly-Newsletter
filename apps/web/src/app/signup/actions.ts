"use server";

import { redirect } from "next/navigation";
import { prisma } from "@platform/db";
import { createUserAccount } from "@/lib/auth/signup";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { signIn } from "@/auth";
import { str } from "@/lib/form-data";

// Handles both a plain "create a portal account" signup and the funnel
// hand-off case: an anonymous visitor hits a funnel's checkout-type block
// with no session, gets redirected here (productId/funnelId/lead carried
// as hidden fields), and on success is sent straight to Stripe Checkout
// instead of back through the funnel.
export async function signupAction(formData: FormData) {
  const email = str(formData, "email");
  const password = str(formData, "password");
  const name = str(formData, "name");
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const user = await createUserAccount({ email, password, name });

  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch {
    throw new Error("Account created, but signing you in failed — please log in.");
  }

  const productId = str(formData, "productId");
  if (productId) {
    const leadContactId = str(formData, "lead");
    const funnelId = str(formData, "funnelId");
    const deal =
      leadContactId && funnelId
        ? await prisma.deal.findFirst({ where: { contactId: leadContactId, funnelId } })
        : null;

    const url = await createCheckoutSession({ productId, userId: user.id, dealId: deal?.id });
    redirect(url);
  }

  redirect("/portal");
}
