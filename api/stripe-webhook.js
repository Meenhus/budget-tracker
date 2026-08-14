const Stripe = require("stripe");
const { querySupabase } = require("./_supabase");

const paidStates = new Set(["active", "trialing"]);

async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).send("Method not allowed");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let event;
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    event = stripe.webhooks.constructEvent(rawBody, request.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    return response.status(400).send(`Webhook error: ${error.message}`);
  }
  try {
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const status = paidStates.has(subscription.status) ? "pro" : "free";
      await querySupabase(`budget_workspaces?stripe_customer_id=eq.${subscription.customer}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          subscription_status: status,
          subscription_price_id: subscription.items.data[0]?.price?.id || null,
          subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
        })
      });
    }
    return response.status(200).json({ received: true });
  } catch (error) {
    console.error(error);
    return response.status(500).json({ error: "Webhook processing failed" });
  }
}

module.exports = handler;
module.exports.config = { api: { bodyParser: false } };
