const Stripe = require('stripe');
const { querySupabase } = require('../../api/_supabase');

const paidStates = new Set(['active', 'trialing']);

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  try {
    const signature = event.headers['stripe-signature'];
    const rawBody = event.body;
    const eventData = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(eventData.type)) {
      const subscription = eventData.data.object;
      const status = paidStates.has(subscription.status) ? 'pro' : 'free';

      await querySupabase(`budget_workspaces?stripe_customer_id=eq.${subscription.customer}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          subscription_status: status,
          subscription_price_id: subscription.items.data[0]?.price?.id || null,
          subscription_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        }),
      });
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 400, body: `Webhook error: ${error.message}` };
  }
};
