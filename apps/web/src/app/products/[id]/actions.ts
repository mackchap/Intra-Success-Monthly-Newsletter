"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession } from "@/lib/billing/checkout";
import { requireSession } from "@/lib/require-auth";

export async function buyProductAction(formData: FormData) {
  const session = await requireSession();

  const productId = formData.get("productId");
  if (typeof productId !== "string" || !productId) {
    throw new Error("productId is required.");
  }

  const url = await createCheckoutSession({ productId, userId: session.user.id });
  redirect(url);
}
