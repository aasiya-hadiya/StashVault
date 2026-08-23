export type ClaimAssistantProduct = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  purchasedAt?: string | Date | null;
  purchasedFrom?: string | null;
  invoiceNumber?: string | null;
  serialNumber?: string | null;
  warrantyStatus?: "protected" | "expiring" | "expired" | "review_needed";
  warrantyExpiresAt?: string | Date | null;
};

export type ClaimAssistantDocument = { documentType: string; name?: string | null };

type ClaimAssistantInput = {
  product: ClaimAssistantProduct;
  documents: ClaimAssistantDocument[];
};

function dateOnly(value?: string | Date | null) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(value?: string | Date | null) {
  const normalized = dateOnly(value);
  if (!normalized) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Claim-assistant contract: only product fields, document metadata, and the
 * user's issue text may appear in the request. Missing evidence remains named
 * as missing rather than inferred.
 */
export function buildClaimAssistantState({ product, documents }: ClaimAssistantInput) {
  const hasProofOfPurchase = documents.some(document => document.documentType === "invoice" || document.documentType === "receipt" || document.documentType === "order_confirmation");
  const hasWarrantyDocument = documents.some(document => document.documentType === "warranty");
  const hasSerial = Boolean(product.serialNumber?.trim());
  const warrantyLabel = product.warrantyStatus === "protected"
    ? "Warranty active"
    : product.warrantyStatus === "expiring"
      ? "Warranty ending soon"
      : product.warrantyStatus === "expired"
        ? "Warranty expired"
        : "Warranty needs review";
  const warrantyDetail = product.warrantyStatus === "protected" || product.warrantyStatus === "expiring"
    ? (displayDate(product.warrantyExpiresAt) ? `Recorded expiry: ${displayDate(product.warrantyExpiresAt)}` : "Coverage is recorded; expiry date needs review")
    : product.warrantyStatus === "expired"
      ? (displayDate(product.warrantyExpiresAt) ? `Recorded expiry: ${displayDate(product.warrantyExpiresAt)}` : "Recorded coverage has expired")
      : "Add a warranty date or document before contacting support.";

  return {
    productName: product.name,
    warranty: { status: product.warrantyStatus ?? "review_needed", label: warrantyLabel, detail: warrantyDetail, expiresAt: dateOnly(product.warrantyExpiresAt) },
    checklist: [
      { key: "proof", label: "Proof of purchase", status: hasProofOfPurchase ? "available" : "missing", detail: hasProofOfPurchase ? "A receipt, invoice, or order confirmation is saved." : "Upload a receipt, invoice, or order confirmation." },
      { key: "serial", label: "Serial number", status: hasSerial ? "available" : "review_needed", detail: hasSerial ? "Serial number is saved with this product." : "Add the serial number if the manufacturer asks for it." },
      { key: "coverage", label: "Warranty coverage", status: product.warrantyStatus === "protected" || product.warrantyStatus === "expiring" ? "available" : product.warrantyStatus === "expired" ? "expired" : "review_needed", detail: warrantyDetail },
      { key: "warranty-document", label: "Warranty document", status: hasWarrantyDocument ? "available" : "review_needed", detail: hasWarrantyDocument ? "A warranty document is saved." : "Optional: upload warranty terms if you have them." },
    ] as const,
  };
}

export function generateClaimRequest(input: ClaimAssistantInput & { issue: string }) {
  const state = buildClaimAssistantState(input);
  const { product } = input;
  const identity = [product.brand, product.name, product.model].filter(Boolean).join(" ");
  const lines = [
    `Subject: Service request — ${identity || product.name}`,
    "",
    "Hello Support Team,",
    "",
    `I am requesting assistance with my ${identity || product.name}.`,
    `Issue: ${input.issue.trim()}`,
    product.purchasedAt ? `Purchase date: ${displayDate(product.purchasedAt)}` : null,
    product.purchasedFrom ? `Purchased from: ${product.purchasedFrom}` : null,
    product.serialNumber ? `Serial number: ${product.serialNumber}` : null,
    product.invoiceNumber ? `Invoice number: ${product.invoiceNumber}` : null,
    `Warranty status: ${state.warranty.label}${state.warranty.expiresAt ? ` (${displayDate(state.warranty.expiresAt)})` : ""}`,
    state.checklist.find(item => item.key === "proof")?.status === "available" ? "Proof of purchase is available in my records." : "Proof of purchase is not currently saved in my records.",
    "",
    "Please let me know the next steps and any information you need from me.",
    "",
    "Thank you,",
  ].filter((line): line is string => Boolean(line));
  return { ...state, request: lines.join("\n") };
}
