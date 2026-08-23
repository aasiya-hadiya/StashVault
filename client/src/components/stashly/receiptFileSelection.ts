export type ReceiptCandidate = Pick<File, "name" | "size" | "type">;

export const receiptFileInputSettings = {
  accept: "application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp",
  cameraAccept: "image/jpeg,image/png,image/webp",
  capture: "environment" as const,
  maxBytes: 10 * 1024 * 1024,
};

const acceptedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function validateReceiptCandidate(candidate?: ReceiptCandidate) {
  if (!candidate) return { accepted: false as const, message: "Choose a receipt or invoice to begin." };
  if (!acceptedMimeTypes.has(candidate.type)) return { accepted: false as const, message: "Please choose a PDF, JPG, PNG, or WEBP image." };
  if (candidate.size > receiptFileInputSettings.maxBytes) return { accepted: false as const, message: "This file is too large. Please choose one under 10 MB." };
  return { accepted: true as const, file: candidate };
}
