# Finhaus Leads Dashboard

Next.js dashboard that reads real Forminator submissions from the Finhaus WordPress REST endpoint.

## Vercel environment variables

Required:

```
FINHAUS_WP_API_KEY=your-wordpress-api-key
```

Optional:

```
FINHAUS_WP_API_URL=https://finhaus.lt/wp-json/finhaus/v1/submissions
```

The API key is used only server-side by `/api/submissions` and is never exposed to the browser.

## Local development

```bash
npm install
npm run dev
```
