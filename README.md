# AssetCues RBAC Document Assistant — Web

Next.js 15 frontend for the AssetCues document assistant.

## Screens

| Route | For | What it does |
|---|---|---|
| `/login` | Everyone | Google SSO for staff, email/password for customers. |
| `/chat` | Everyone | Streaming answers with citations. A refusal offers Request access. |
| `/admin/documents` | Admin | Review queue, grant access per role, upload, delete. |
| `/admin/users` | Admin | Users, roles, enable/disable. |
| `/admin/compare` | Admin | One question run as every role, side by side. |
| `/admin/audit` | Admin | Every query, decision and anomaly. |

## Setup

```bash
cp .env.example .env.local     # fill in the API URL and Supabase values
npm install
npm run dev
```

Both environment values are public by design. **No secret belongs in this
repository** — the OpenAI key and the Supabase service-role key live only in
the API.

## Verify

```bash
npm run verify     # lint + typecheck + production build
```

## The demo

1. Sign in as an admin, open **Documents**, approve the pending set.
2. Open **Compare roles** and ask *"What is the Partner Entitlement
   Envelope?"* — Sales, Product and Engineering answer with citations;
   QA, Support and Customer refuse, and the card shows the License Management
   BRD being withheld.
3. Open **Audit** to see the same events recorded, including which documents
   were blocked and for whom.

Deployment and the founder walkthrough: `../assetcues-chatbot-api/docs/RUNBOOK.md`.
