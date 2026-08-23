# StashVault

> A private ownership assistant for receipts, warranties, return windows, product records, and supporting documents.

**Live demo:** _Add the Vercel production URL here._

Example: [Open StashVault](https://your-project.vercel.app)

## What it does

StashVault helps people keep proof of purchase and product details in one place. It turns a receipt into a reviewable product record, tracks important ownership dates, and keeps the original document attached to the item.

| Feature | Summary |
|---|---|
| Receipt capture and OCR | Upload or capture a receipt, review the extracted fields, then save the product record. |
| My Stash | Keep products, purchase details, serial/model information, and linked proof together. |
| Documents and CSV export | Store supporting files and export the signed-in user’s extracted document data as CSV. |
| Warranty, returns, and Risk Radar | Track date-only lifecycle facts and surface relevant attention items. |
| Ask StashVault | Ask evidence-limited questions about saved products and document metadata. |
| Before You Buy and Repair | Compare possible purchases and receive repair-first guidance from saved lifecycle facts. |
| Settings | Save a display name and choose in-app reminder categories. |

## Built with

React, TypeScript, Vite, Tailwind CSS, Node.js, Express, tRPC, Drizzle ORM, MySQL/TiDB-compatible SQL, object storage, Tesseract OCR, and a server-side AI gateway.

## Run locally

Use **Node.js 22** and **pnpm 10**.

```bash
git clone https://github.com/aasiya-hadiya/StashVault.git
cd StashVault
corepack enable
pnpm install
pnpm dev
```

For receipt OCR, install Tesseract and Poppler:

```bash
sudo apt-get install -y poppler-utils tesseract-ocr tesseract-ocr-eng
```

The application also needs a MySQL/TiDB-compatible database, OAuth configuration, file storage, and server-side AI credentials. Never commit `.env` files or production secrets.

## Test and build

```bash
pnpm check
pnpm test
pnpm build
```

## Deploy on Vercel

The repository includes `vercel.json`, `api/index.js`, and `pnpm build:vercel` for Vercel. Connect the `main` branch, use Node.js 22, and do not set a manual Output Directory that overrides the committed configuration.

The deployment needs its own approved database, OAuth callback, storage, AI, and OCR setup. Do not copy managed-platform credentials into Vercel.

## Demo flow

1. Sign in and add a receipt with **Scan receipt**.
2. Review the OCR fields and save the product to **My Stash**.
3. Open the product to see its document, warranty, return, and lifecycle details.
4. Use **Documents** to download the extracted document-data CSV.
5. Open **Risk Radar**, **Ask StashVault**, or **Repair & Sustainability** to explore the saved record.

## Privacy by design

Each protected record is scoped to the signed-in account. OCR and AI can assist with review, but unsupported values stay blank or need review. Product, warranty, and return dates are stored as date-only business values.

## License

MIT
