# Intra Success Academy

A business platform combining a marketing site + client portal, a CRM, sales
funnels with automation, a course academy, Stripe payments, and AI agents —
built in phases.

See [CLAUDE.md](./CLAUDE.md) for the full stack breakdown, folder structure,
conventions, local dev setup, and the Railway deploy runbook.

## Quick start

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:3000.
