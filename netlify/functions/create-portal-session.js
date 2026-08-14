const Stripe = require('stripe');
const { getAuthenticatedUser, querySupabase } = require('../../api/_supabase');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = await getAuthenticatedUser({
      headers: { authorization: event.headers.authorization || '' },
    });

    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sign in before managing billing.' }) };
    }

    const rows = await querySupabase(`budget_workspaces?user_id=eq.${user.id}&select=stripe_customer_id`);
    const customerId = rows[0]?.stripe_customer_id;
    if (!customerId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No billing profile found.' }) };
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: process.env.APP_URL,
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
      body: JSON.stringify({ error: 'Unable to open the billing portal.' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
