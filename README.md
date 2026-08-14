# The Ledger

The Ledger is a business budget tracker with a static local-first mode and an optional live SaaS mode.

## Run locally

Open `Index.html` in a browser. It works without installing packages and saves data locally in the browser.

## Enable live accounts and cloud data

1. Create a Supabase project and run `supabase/schema.sql` in its SQL Editor.
2. In Supabase Authentication, enable Email/password sign-in and configure the site's redirect URL. New registrations require a phone number and country; those values are saved in the protected `profiles` table.
3. Copy the project URL and anon key into `app-config.js`.
4. Create a Stripe product with a recurring Pro price.
5. Deploy this folder to Vercel and add every value in `.env.example` as an environment variable.
6. In Stripe, create a webhook pointing to `https://your-domain.com/api/stripe-webhook` and subscribe to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
7. Configure Stripe's customer portal before exposing the billing-management endpoint.

## Security model

- Browser code uses only the Supabase anon key.
- Row Level Security restricts each workspace to its owner.
- Stripe secret keys and the Supabase service-role key are used only inside Vercel API functions.
- Stripe webhooks are signature-verified before subscription status is updated.
