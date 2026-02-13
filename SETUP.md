# Echo Legacy - Setup Guide

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional) [Stripe](https://stripe.com) account for subscriptions
- (Optional) [OpenAI](https://platform.openai.com) API key for transcription

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

### Required Variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/public key (Settings > API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (Settings > API) |

### Optional Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key for Whisper transcription + GPT summarization |
| `STRIPE_SECRET_KEY` | Stripe secret key for subscription billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_PRICE_MONTHLY` | Stripe Price ID for monthly plan |
| `STRIPE_PRICE_ANNUAL` | Stripe Price ID for annual plan |
| `NEXT_PUBLIC_APP_URL` | Your app's URL (defaults to http://localhost:3000) |

## 3. Set Up the Database

1. Go to your Supabase project dashboard
2. Open the **SQL Editor**
3. Paste the contents of `supabase-schema.sql` and run it

This creates all tables, indexes, RLS policies, storage buckets, and seed prompts.

## 4. Configure Supabase Auth

1. In Supabase dashboard, go to **Authentication > Providers**
2. Enable **Email** provider
3. Enable **OTP** (one-time password) for email sign-in
4. Optionally configure email templates under **Authentication > Email Templates**

## 5. Set Up Storage

The schema SQL creates a `recordings` storage bucket automatically. Verify it exists:

1. Go to **Storage** in your Supabase dashboard
2. Confirm the `recordings` bucket exists
3. If not, create it manually (private, not public)

## 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 7. (Optional) Set Up Stripe

For subscription billing:

1. Create a Stripe account and get your API keys
2. Create two subscription products/prices:
   - Monthly plan (e.g., $9.99/month)
   - Annual plan (e.g., $79.99/year)
3. Set `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_ANNUAL` to the Price IDs
4. Set up a webhook endpoint pointing to `https://your-domain.com/api/stripe/webhook`
5. Listen for events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
6. Set `STRIPE_WEBHOOK_SECRET` to the webhook signing secret

For local testing, use the Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## 8. (Optional) Set Up Transcription

For automatic transcription and AI-generated summaries:

1. Get an OpenAI API key from [platform.openai.com](https://platform.openai.com)
2. Set `OPENAI_API_KEY` in your `.env.local`
3. The app uses:
   - **Whisper API** for audio-to-text transcription with timestamps
   - **GPT-4o-mini** for generating summaries and tags

Without an OpenAI key, recordings will still work but transcripts will show a placeholder message.

## 9. Deploy

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the repo in [Vercel](https://vercel.com)
3. Add all environment variables in Vercel's project settings
4. Deploy

### Other Platforms

The app is a standard Next.js application. Any platform that supports Next.js will work:
- Railway
- Render
- AWS Amplify
- Self-hosted with `npm run build && npm start`

## Architecture Overview

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── recordings/    # Recording processing pipeline
│   │   └── stripe/        # Stripe checkout, portal, webhooks
│   ├── auth/              # Auth callback handler
│   ├── invite/[code]/     # Invite join page
│   ├── login/             # Email OTP login
│   ├── onboarding/        # Create/join vault
│   ├── vault/             # Vault list
│   └── vault/[vaultId]/   # Main app shell
│       ├── page.tsx       # Home/timeline
│       ├── record/        # Audio recorder
│       ├── recording/     # Recording detail + player
│       ├── search/        # Full-text search
│       └── settings/      # Vault & account settings
├── components/            # Shared UI components
├── hooks/                 # Custom React hooks
│   ├── useAudioRecorder   # MediaRecorder wrapper
│   └── useAudioPlayer     # HTML5 Audio wrapper
├── lib/                   # Utilities
│   ├── auth-context.tsx   # Auth state provider
│   └── supabase/          # Supabase client helpers
└── types/                 # TypeScript type definitions

supabase-schema.sql        # Complete database schema
public/
├── manifest.json          # PWA manifest
└── sw.js                  # Service worker
```

## Key Features

- **Audio Recording**: MediaRecorder API with pause/resume, audio level visualization
- **Daily Limit**: 10 minutes/day per user, tracked in usage_logs
- **Paywall**: 3 free recordings per vault, then requires Pro subscription
- **Transcription**: OpenAI Whisper with timed segments
- **AI Summaries**: GPT-generated summaries and tags
- **Full-text Search**: Searches across titles, summaries, and transcript segments
- **Tappable Transcript**: Click any segment to jump to that timestamp
- **Vault Invitations**: Share invite codes or links
- **Role-based Access**: Owner, Member, Viewer with appropriate permissions
- **PWA**: Installable with offline support via service worker
- **Material Design 3**: Dark theme with accessible touch targets
