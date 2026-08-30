# AssetCues Chatbot Web

Next.js 15 App Router frontend: chat, admin panel, role comparison, audit
console. It talks to `assetcues-chatbot-api` and to Supabase Auth.

## Commands

```bash
npm run dev        # localhost:3000
npm run verify     # lint + typecheck + build — run before saying done
npm run build
```

## The three rules

1. **Never send an identity claim.** No request body may contain `role`,
   `tenant_id`, `clearance`, or a caller `user_id`. The server derives all of
   it from the JWT and ignores anything else. `lib/api.ts` is the only place
   that talks to the backend; keep it that way.
2. **UI gating is cosmetic.** `me.is_admin` decides which links render. It is
   convenience, not security — every admin route re-checks server-side. Never
   reason as though hiding a button protects anything.
3. **No secret belongs in this repository.** Anything named `NEXT_PUBLIC_*` is
   shipped to the browser. The OpenAI key and the Supabase service-role key
   live only in the API.

## Layout

| Path | What |
|---|---|
| `lib/api.ts` | Typed backend client + SSE streaming. The only network layer. |
| `lib/supabase.ts` | Browser auth client. |
| `components/Shell.tsx` | Authenticated layout, nav, sign-out. |
| `components/Badges.tsx` | Shared visual language for roles, sensitivity, status. |
| `app/chat/` | Streaming chat, citations, refusal + request-access card. |
| `app/admin/documents/` | Review queue, ACL grants, upload, delete. |
| `app/admin/users/` | Users, roles, enable/disable. |
| `app/admin/compare/` | One question across every role, side by side. |
| `app/admin/audit/` | Audit console. |

## Conventions

- TypeScript strict, `noUncheckedIndexedAccess` on.
- Tailwind v4. Reusable classes are declared with `@utility` in
  `app/globals.css` — plain `.class { @apply other-custom-class }` does not
  work in v4 and fails the build.
- Client components throughout; there is no server-side data fetching because
  every call needs the user's Supabase token.
- Handle the `retracted` stream event: an answer can be withdrawn after
  streaming when citation validation fails. Replace, do not append.

## Environment

Copy `.env.example` to `.env.local`. Both values are public by design.
