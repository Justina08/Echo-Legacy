import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
  });

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const vaultId = session.metadata?.vault_id;

      if (vaultId && session.subscription) {
        await supabase
          .from("vaults")
          .update({
            is_pro: true,
            stripe_subscription_id: session.subscription as string,
          })
          .eq("id", vaultId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: vault } = await supabase
        .from("vaults")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (vault) {
        const isActive = ["active", "trialing"].includes(subscription.status);
        await supabase
          .from("vaults")
          .update({ is_pro: isActive })
          .eq("id", vault.id);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: vault } = await supabase
        .from("vaults")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (vault) {
        await supabase
          .from("vaults")
          .update({
            is_pro: false,
            stripe_subscription_id: null,
          })
          .eq("id", vault.id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
