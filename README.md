# Heruka KMC Dashboard

A single-page marketing dashboard for monitoring WooCommerce event performance, sales trends, and product health at meditateinlondon.org.

## Prerequisites

- Node.js ≥ 20
- Vercel CLI: `npm i -g vercel`

## Getting started

```bash
git clone https://github.com/rolandjlevy/heruka-kmc-dashboard.git
cd heruka-kmc-dashboard
cp .env.example .env.local
```

Edit `.env.local` and add your real WooCommerce API keys:

```
WC_BASE_URL=https://meditateinlondon.org/wp-json/wc/v3
WC_CONSUMER_KEY=ck_xxx
WC_CONSUMER_SECRET=cs_xxx
```

Generate read-only keys at: **WP Admin → WooCommerce → Settings → Advanced → REST API → Add key**

Then start the local dev server:

```bash
vercel dev
```

First time you run it, answer the prompts:

| Prompt | Answer |
|--------|--------|
| Set up and develop? | Y |
| Link to existing project? | N |
| Project name? | wc-dashboard |
| Which directory? | ./ |

Dashboard is live at **http://localhost:3000**

## Deploy to production

```bash
vercel --prod
```

Or push to `main` with the Vercel GitHub integration enabled. Set the three environment variables in **Vercel dashboard → Settings → Environment Variables**.

## Data sources

| Endpoint | WooCommerce API calls | Data used |
|----------|----------------------|-----------|
| `/api/sales` | `GET /reports/sales` | Revenue, orders, daily totals |
| `/api/top-sellers` | `GET /reports/top_sellers` | Top 10 products by units sold |
| `/api/totals` | `GET /reports/orders/totals`, `products/totals`, `customers/totals`, `reviews/totals` | Aggregate counts by status |
| `/api/products` | `GET /products` | Stock levels and prices |
| `/api/categories` | `GET /products/categories` | Category product counts |

## GDPR

This dashboard only accesses product and aggregated report data. It never calls `/orders`, `/customers`, `/refunds`, or any endpoint that returns personal data. No customer information is fetched, stored, or displayed.
