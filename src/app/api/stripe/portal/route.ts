import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-03-31.basil" as Stripe.LatestApiVersion,
  });

  try {
    const { vaultId } = await request.json();

    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: vault } = await supabase
      .from("vaults")
      .select("stripe_customer_id, owner_user_id")
      .eq("id", vaultId)
      .single();

    if (!vault || vault.owner_user_id !== user.id || !vault.stripe_customer_id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const session = await stripe.billingPortal.sessions.create({
      customer: vault.stripe_customer_id,
      return_url: `${appUrl}/vault/${vaultId}/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
