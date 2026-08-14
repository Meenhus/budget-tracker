const Stripe = require('stripe');
const { getAuthenticatedUser, querySupabase } = require('../../api/_supabase');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = await getAuthenticatedUser({
      headers: {
        authorization: event.headers.authorization || '',
      },
    });

    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sign in before upgrading.' }) };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const rows = await querySupabase(`budget_workspaces?user_id=eq.${user.id}&select=stripe_customer_id`);
    const workspace = rows[0];
    let customer = workspace?.stripe_customer_id;

    if (!customer) {
      const created = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customer = created.id;
      await querySupabase(`budget_workspaces?user_id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ stripe_customer_id: customer }),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${process.env.APP_URL}/?checkout=success`,
      cancel_url: `${process.env.APP_URL}/?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Unable to create a billing session.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
