import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is not configured. Set STRIPE_SECRET_KEY in your environment." },
      { status: 500 }
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
  });

  try {
    const { vaultId, priceType = "monthly" } = await request.json();

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user is vault owner
    const { data: vault } = await supabase
      .from("vaults")
      .select("*")
      .eq("id", vaultId)
      .eq("owner_user_id", user.id)
      .single();

    if (!vault) {
      return NextResponse.json({ error: "Only vault owners can subscribe" }, { status: 403 });
    }

    if (vault.is_pro) {
      return NextResponse.json({ error: "Vault is already on Pro plan" }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = vault.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          vault_id: vaultId,
          user_id: user.id,
        },
      });
      customerId = customer.id;

      await supabase
        .from("vaults")
        .update({ stripe_customer_id: customerId })
        .eq("id", vaultId);
    }

    const priceId = priceType === "annual"
      ? process.env.STRIPE_PRICE_ANNUAL
      : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return NextResponse.json(
        { error: "Stripe price not configured. Set STRIPE_PRICE_MONTHLY and STRIPE_PRICE_ANNUAL." },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${appUrl}/vault/${vaultId}/settings?upgraded=true`,
      cancel_url: `${appUrl}/vault/${vaultId}/settings`,
      metadata: {
        vault_id: vaultId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
