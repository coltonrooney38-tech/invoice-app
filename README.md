# Invoices · Rooney Response Co

Fill out a short form → preview the PDF → **Send**. The invoice is emailed to the client from your Gmail with the PDF attached.

```
Form (Next.js on Vercel, password-protected)
  ├─ Preview → /api/preview renders the PDF (react-pdf) so you see exactly what the client gets
  └─ Send    → triggers the Trigger.dev task "send-invoice"
                 ├─ renders the same PDF
                 ├─ uploads it to Composio
                 └─ GMAIL_SEND_EMAIL from your connected Gmail (Composio handles the Google sign-in)
```

## One-time setup

1. **`.env`**: copy `.env.example` to `.env` and fill it in:
   - `TRIGGER_SECRET_KEY`: Trigger.dev dashboard → your project → API keys → **Development** key (`tr_dev_…`)
   - `COMPOSIO_API_KEY`: platform.composio.dev → Settings → API Keys
   - `COMPOSIO_USER_ID`: any fixed name you choose, e.g. `rooney-response`
   - `FORM_PASSWORD`: the password for the form
2. **Project ref**: put your Trigger.dev project ref (`proj_…`, shown in Project settings) in `trigger.config.ts`.
3. **Connect Gmail**: run `npm run connect`, open the link it prints, and approve. Safe to re-run.
4. **Log in to Trigger.dev**: `npx trigger.dev@4.8.3 login`

## Run it on your PC

Open two terminals:

```
npm run trigger:dev    # runs the send-invoice task locally
npm run dev            # the form, at http://localhost:3000
```

`npm run sample` writes `sample-invoice.pdf` so you can check the layout without sending anything.

## Put it online

1. **Task → Trigger.dev**: `npm run trigger:deploy`. Then in the Trigger.dev dashboard → **Production** → Environment Variables, add `COMPOSIO_API_KEY` and `COMPOSIO_USER_ID`.
2. **Form → Vercel**: `npx vercel login`, then `npx vercel --prod`. In the Vercel project, set:
   - `TRIGGER_SECRET_KEY`: the **Production** key (`tr_prod_…`)
   - `FORM_PASSWORD`

   Vercel doesn't need the Composio keys. Only the Trigger.dev task talks to Gmail.

## Changing things

| What | Where |
|---|---|
| Business name, address, email, payment line, terms, default tax and due days | `src/invoice/business.ts` |
| PDF layout and colors | `src/invoice/InvoicePdf.tsx` |
| Email subject and body | `src/trigger/send-invoice.ts` |
| Form fields and validation | `src/app/invoice-form.tsx`, `src/invoice/schema.ts` |

After changing anything the task uses (PDF, email, business details), run `npm run trigger:deploy` again. For the form, redeploy to Vercel.

## Safety nets

- Sending the same invoice # again within 10 minutes reuses the first run, so a double-click can't email the client twice.
- If a send fails in an unclear way and the task retries, it first checks your Sent mail and skips the send if the invoice already went out.
- If Gmail isn't connected, the task fails right away with "run npm run connect" instead of retrying.
