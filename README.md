# Qualify

A personal, Typeform-style builder for **lead qualification and appointment-setting pages**. Build a form, score every answer, route leads with conditional logic, and send qualified leads straight to your Calendly or Cal.com calendar. All of it is published on your own link.

- **Builder:** three-pane editor with a live preview (desktop and mobile), drag-to-reorder questions, autosave and one-click publish. Drafts stay private until you publish, so you can edit safely while a form is live.
- **Public form (`/f/your-link`):** one question at a time with smooth, staggered motion, keyboard shortcuts (Enter, A–Z, Y/N, 1–0), validation, answer recall (`{name}`), and a progress bar. Works on mobile, can be embedded, and respects reduced motion.
- **Lead scoring:** points per choice, Yes/No, or rating step. Leads at or above the threshold get the **Qualified** ending (with your booking calendar). Everyone else gets the **Disqualified** ending.
- **Conditional logic:** "If answer is/contains/>/< … jump to question or ending". Use it for hard disqualifiers such as "budget under $2.5k".
- **Booking:** embeds Calendly or Cal.com, prefilled with the lead's name and email.
- **Leads inbox:** every response is saved as it happens, including partial ones. You get filters, search, a detail drawer, and CSV export. UTM parameters and the referrer are captured too.
- **Analytics:** views, starts, completion rate, qualified rate, 30-day trend, outcome breakdown, and drop-off per question.
- **Design:** four themes (Onyx, Graphite, Midnight, Ivory), accent colors, three type styles (Modern, Editorial serif, Technical), an ambient glow, and your logo.

## Quick start

```bash
npm install
npm run dev                 # http://localhost:3000
```

The first `npm run dev` sets everything up automatically on Windows, macOS and Linux. It creates `.env` with a random session secret and creates the local database. The default password is `change-me`. Change `ADMIN_PASSWORD` in `.env`, then restart. To rebuild the database later, run `npm run setup`.

Sign in and create a form from a template, then:

1. Edit questions and endings in **Build**. Use **Form → Qualification** to set your score threshold.
2. Paste your Calendly or Cal.com event link under **Form → Booking**.
3. Click **Preview** to test the full flow. Preview responses aren't saved.
4. Click **Publish**. Share the link, embed it, or use the button snippet from **Share**.

After publishing, keep editing freely. Changes only go live when you click **Publish changes**.

## Deploying

The app is a standard Next.js 15 app. For production, use Postgres (Neon, Supabase, Railway, Vercel Postgres, and so on):

1. In `prisma/schema.prisma`, change `provider = "sqlite"` to `provider = "postgresql"`.
2. Set the environment variables `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` (`openssl rand -hex 32`).
3. Run `npx prisma db push` once against the production database, then deploy (`npm run build`, `npm start`, or push to Vercel).

## Project layout

```
prisma/schema.prisma          Form + Response models
src/lib/engine.ts             Scoring, validation, conditional logic, routing (shared client/server)
src/lib/templates.ts          Starter templates and block factories
src/components/form/          Public form renderer (views + runner with animations)
src/components/builder/       Builder: block list, canvas, inspector, settings, share
src/app/f/[slug]              Public form page
src/app/forms/[id]/…          Build / Leads / Analytics
src/app/api/…                 Admin API (auth-protected) + public submission API
```

Outcomes are decided on the server. When someone submits, the server replays their answers through the same engine, so the score and the qualified/disqualified status can't be faked from the browser.
