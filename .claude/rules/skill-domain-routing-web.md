---
origin: theonekit-web
repository: The1Studio/theonekit-web
module: null
protected: false
---
<!-- t1k-origin: kit=theonekit-web | repo=The1Studio/theonekit-web | module=null | protected=true -->

# Skill Domain Routing (theonekit-web)

Intent-based discovery for web kit skills. For core T1K skills (cook, fix, plan, etc.), see `skills/t1k-help/references/skill-domain-routing.md`.

## Frontend Development

User wants to...
- Build React components using modern patterns (hooks, suspense, server components) → `t1k:web:frontend:development`
- Style with Tailwind CSS or shadcn/ui components → `t1k:web:ui:styling`
- Replicate a design from a screenshot, video, or Figma mockup → `t1k:web:frontend:ui`
- Apply React performance optimization patterns → `t1k:web:frontend:react-best-practices`
- Use TanStack ecosystem (Query, Router, Form, Table) → `t1k:web:frontend:tanstack`

## Backend Development

User wants to...
- Build REST, GraphQL, or tRPC APIs → `t1k:web:core:backend-development`
- Add authentication (Better Auth, OAuth, sessions, magic links) → `t1k:web:backend:better-auth`
- Design or query relational/document databases (Postgres, MongoDB, SQLite) → `t1k:web:backend:databases`

## UI/UX Design

User wants to...
- Review UI for accessibility, contrast, spacing, and UX quality → `t1k:web:ui:guidelines`
- Apply advanced UX/UI design patterns (50+ styles, micro-interactions) → `t1k:web:ui:ux-pro-max`
- Generate designs using AI (Stitch) → `t1k:web:ui:stitch`
- Build brand identity and design systems → `t1k:web:ui:brand`

## Web Frameworks

User wants to...
- Build with Next.js App Router, RSC, Server Actions → `t1k:web:core:frameworks`

## Testing

User wants to...
- Write Playwright E2E, Vitest unit, or k6 load tests → `t1k:web:testing:core`

## DevOps & Deployment

User wants to...
- Deploy to Cloudflare, GCP, Kubernetes, or Docker → `t1k:web:devops:core`
- Quick deploy to any cloud platform → `t1k:web:devops:deploy`

## Commerce & Payments

User wants to...
- Integrate payment processors (Stripe, Paddle, SePay, Polar) → `t1k:web:commerce:payment-integration`
- Build Shopify storefront apps, themes, or Liquid templates → `t1k:web:commerce:shopify`

## Content & Documentation

User wants to...
- Write high-conversion marketing or product copy → `t1k:web:content:copywriting`
- Build or customize a Mintlify documentation site → `t1k:web:content:mintlify`

## Notes

- All skills above are web-kit skills; invoke via the Skill tool
- For core T1K workflow skills (cook, fix, plan, test, review), see `skills/t1k-help/references/skill-domain-routing.md`
- Combine frontend + backend skills for full-stack features; see `skills/t1k-help/references/skill-workflow-routing.md` for chains
