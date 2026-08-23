export type ReceiptReviewSignal = {
  confidence?: number | null;
  uncertainFields?: string[] | null;
};

export type ReceiptFieldEvidenceStatus = "read" | "review";

export function getReceiptFieldEvidenceStatus(field: string, value: string | null | undefined, uncertainFields?: string[] | null): ReceiptFieldEvidenceStatus {
  if (!value?.trim() || uncertainFields?.includes(field)) return "review";
  return "read";
}

export function getReceiptReviewState(extraction?: ReceiptReviewSignal) {
  const lowConfidence = (extraction?.confidence ?? 0) < 70;
  const uncertainFieldCount = extraction?.uncertainFields?.length ?? 0;

  return {
    lowConfidence,
    uncertainFieldCount,
    requiresReview: lowConfidence || uncertainFieldCount > 0,
  };
}
