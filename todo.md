# Stashly Phase 2 Checklist

- [x] Replace the current dashboard-style home with the premium Stashly landing page story.
- [x] Add the landing hero headline, supporting copy, primary and secondary CTAs.
- [x] Build a pastel dashboard visual with laptop, headphones, smartphone, washing machine, and smartwatch cards.
- [x] Add the Upload → AI understands → Stashly remembers → You stay protected story section.
- [x] Add the problem, solution, “Something’s wrong?”, and “Repair before replace” sections.
- [x] Refine `/login` and `/signup` with Name, Email, Password, Continue, and validation/error states.
- [x] Preserve the current Soft Archive design system and responsive app routes.
- [x] Verify desktop/mobile layouts, links, type checking, production build, and browser console output.

## Stashly Phase 3 Checklist

- [x] Upgrade the static project to the full-stack web-db-user template.
- [x] Preserve Manus authentication and wire authenticated user context.
- [x] Add relational schema for users, products, documents, ownership events, reminders, and service records.
- [x] Generate and apply the database migration safely.
- [x] Add typed product, dashboard, document, event, reminder, and service-record procedures.
- [x] Implement product creation, update, deletion, detail loading, search, and filtering with ownership checks.
- [x] Implement reusable product status and warranty countdown services.
- [x] Connect the existing dashboard and product-management UI to real backend data states.
- [x] Add loading, empty, error, success, and auth-gated UI paths.
- [x] Run server tests, type checks, production build, and responsive browser verification.

## Stashly Phase 4 Checklist

- [x] Review `pasted_content_4.txt` and implement its requested Phase 4 enhancements across the existing Stashly application.
- [x] Inspect the existing storage integration and document model, then use the supported private file-storage flow without hardcoded credentials.
- [x] Extend the existing documents model for OCR-ready processing metadata without implementing extraction.
- [x] Add protected tRPC procedures to prepare uploads, create/list/get/delete document records, and generate private document access URLs.
- [x] Enforce PDF/JPG/JPEG/PNG/WEBP validation, a 10 MB limit, friendly errors, and server-side product/document ownership checks.
- [x] Build the Stashly upload flow with document type selection, owned-product picker, progress, success/error states, and dropzone/device selection.
- [x] Integrate document list, preview, download, confirmed deletion, missing-invoice cues, and empty/loading/error states into product details.
- [x] Add a restrained dashboard document indicator without changing the current visual identity.
- [x] Add and run focused tests for validation, ownership boundaries, document metadata, and existing Phase 3 regressions.
- [x] Verify desktop/mobile flows, type checks, production build, and browser-console output without proceeding to OCR or AI extraction.

## Stashly Phase 4B Checklist

- [x] Inspect the available OCR/AI and storage capabilities, then define a safe real-provider or clearly labelled fallback extraction approach.
- [x] Add additive database fields and migration support for OCR source, extraction status, fields, confidence, and review/confirmation state.
- [x] Add authenticated OCR preparation, extraction, and confirmation procedures with Zod validation and ownership checks.
- [x] Create the scan-receipt flow with drag/drop, file browsing, mobile camera capture, validation, and a subtle processing state.
- [x] Build a dedicated editable review screen that flags uncertain or missing fields without inventing price, dates, warranty, or serial data.
- [x] Confirm reviewed extraction by creating or updating the product, retaining and linking the original document, and recording the OCR-assisted ownership event.
- [x] Connect completed OCR documents to product details with verified/added document status and ownership-history context.
- [x] Preserve manual product creation, Phase 4A document management, Phase 3 product flows, and the established Soft Archive visual system.
- [x] Add tests for authorization, validation, extraction responses, confirmation, product-document linking, and ownership boundaries.
- [x] Verify the full desktop/mobile flow, test suite, type check, production build, and browser console without implementing any next phase.

## Phase 4B Verification Follow-up

- [x] Repair the additive database migration so every schema-declared receipt extraction column exists in the managed database.
- [x] Verify and test explicit receipt drag/drop and mobile camera-capture interactions.
- [x] Verify review-screen field uncertainty/missing-state presentation and blank-value handling.
- [x] Verify the OCR-reviewed document status and ownership-event context on product details.
- [x] Add successful confirmation coverage for product creation and retained source-document linking.
- [x] Re-run all tests, type checking, build, browser verification, and database checks before checkpointing Phase 4B.

## Phase 4B Final Evidence Follow-up

- [x] Add an integration-level test for receipt confirmation that verifies product creation, source-document linking, reviewed timestamp, and both ownership events.
- [x] Add explicit component-level coverage or documented interaction verification for receipt drag/drop and mobile camera capture.
- [x] Verify the OCR-reviewed document cue and receipt-confirmation ownership timeline together on a populated product detail route.
- [x] Re-run the complete regression suite, build, database check, and final browser verification after the follow-up fixes.

## Phase 4B Final Database Verification

- [x] Re-run and record an explicit managed-database verification for the receipt extraction and reviewed-document fields after the final Phase 4B evidence changes.
