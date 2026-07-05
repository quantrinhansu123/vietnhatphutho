<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/8820abb2-4948-4cba-8b52-662020163e52

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a local environment file from the example:
   `cp .env.example .env.local`
3. Set the Supabase values in `.env.local`:
   - `SUPABASE_URL
   - `SUPABASE_KEY`
   - `SUPABASE_TABLE`
4. Run the app:
   `npm run dev`
