const Stripe = require("stripe");
const { getAuthenticatedUser, querySupabase } = require("./_supabase");

module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return response.status(401).json({ error: "Sign in before managing billing." });
    const rows = await querySupabase(`budget_workspaces?user_id=eq.${user.id}&select=stripe_customer_id`);
    if (!rows[0]?.stripe_customer_id) return response.status(404).json({ error: "No billing account found." });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({ customer: rows[0].stripe_customer_id, return_url: process.env.APP_URL });
    return response.status(200).json({ url: session.url });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Unable to open billing management." });
  }
};
