export type RepairLifecycleProduct = {
  id: number;
  name: string;
  brand?: string | null;
  purchasedAt?: Date | string | null;
  warrantyStatus: "protected" | "expiring" | "expired" | "review_needed";
  warrantyExpiresAt?: Date | string | null;
  returnStatus: "active" | "expiring" | "expired" | "review_needed";
};

export type RepairBadgeStatus = "safe" | "watch" | "expired" | "neutral";

export function repairRecommendation(product: RepairLifecycleProduct) {
  if (product.warrantyStatus === "protected" || product.warrantyStatus === "expiring") {
    return "Repair may be covered by your warranty.";
  }
  if (product.warrantyStatus === "expired") {
    return "Warranty expired — consider repair before replacement.";
  }
  return "Check your warranty details before replacing.";
}

export function warrantyPresentation(status: RepairLifecycleProduct["warrantyStatus"]): { label: string; badge: RepairBadgeStatus } {
  if (status === "protected") return { label: "Warranty active", badge: "safe" };
  if (status === "expiring") return { label: "Warranty ending soon", badge: "watch" };
  if (status === "expired") return { label: "Warranty expired", badge: "expired" };
  return { label: "Warranty details unavailable", badge: "neutral" };
}

export function returnPresentation(status: RepairLifecycleProduct["returnStatus"]): { label: string; badge: RepairBadgeStatus } {
  if (status === "active") return { label: "Return active", badge: "safe" };
  if (status === "expiring") return { label: "Return ending soon", badge: "watch" };
  if (status === "expired") return { label: "Return expired", badge: "expired" };
  return { label: "Return details unavailable", badge: "neutral" };
}

function repairPriority(product: RepairLifecycleProduct) {
  if (product.warrantyStatus === "expired") return 0;
  if (product.warrantyStatus === "expiring") return 1;
  if (product.warrantyStatus === "review_needed") return 2;
  return 3;
}

export function sortProductsForRepair(products: RepairLifecycleProduct[]) {
  return [...products].sort((first, second) => repairPriority(first) - repairPriority(second) || first.name.localeCompare(second.name));
}

export function repairPageState(products: RepairLifecycleProduct[]) {
  return products.length ? "products" : "empty";
}
