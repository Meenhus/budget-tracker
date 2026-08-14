const Stripe = require("stripe");
const { getAuthenticatedUser, querySupabase } = require("./_supabase");

module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: "Sign in before upgrading." });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rows = await querySupabase(`budget_workspaces?user_id=eq.${user.id}&select=stripe_customer_id`);
    const workspace = rows[0];
    let customer = workspace?.stripe_customer_id;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email, metadata: { supabase_user_id: user.id } });
      customer = created.id;
      await querySupabase(`budget_workspaces?user_id=eq.${user.id}`, {
        method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ stripe_customer_id: customer })
      });
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL}/?checkout=success`,
      cancel_url: `${process.env.APP_URL}/?checkout=cancelled`,
      metadata: { supabase_user_id: user.id }
    });
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to create a billing session." });
  }
};
