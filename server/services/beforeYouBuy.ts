export type ConsideredProductInput = {
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  estimatedPrice?: number | null;
  currency?: string;
  plannedOwnershipMonths?: number | null;
  expectedWarrantyMonths?: number | null;
  repairabilityNotes?: string | null;
  expectedResaleValue?: number | null;
  expectedResaleValueAtMonths?: number | null;
  notes?: string | null;
};

export type ConsideredProductView = ConsideredProductInput & {
  id: number;
  monthlyCost: number | null;
  ownershipEstimateMissing: ("estimatedPrice" | "plannedOwnershipMonths")[];
  resaleEstimate: { value: number; months: number } | null;
};

export type ConsideredProductRow = ConsideredProductInput & { id: number };

export function buildConsideredProductView(product: ConsideredProductRow): ConsideredProductView {
  const ownershipEstimateMissing: ("estimatedPrice" | "plannedOwnershipMonths")[] = [];
  if (product.estimatedPrice === null || product.estimatedPrice === undefined) ownershipEstimateMissing.push("estimatedPrice");
  if (product.plannedOwnershipMonths === null || product.plannedOwnershipMonths === undefined) ownershipEstimateMissing.push("plannedOwnershipMonths");
  const monthlyCost = ownershipEstimateMissing.length
    ? null
    : Number((Number(product.estimatedPrice) / Number(product.plannedOwnershipMonths)).toFixed(2));
  const resaleEstimate = product.expectedResaleValue !== null && product.expectedResaleValue !== undefined && product.expectedResaleValueAtMonths
    ? { value: Number(product.expectedResaleValue), months: product.expectedResaleValueAtMonths }
    : null;
  return { ...product, monthlyCost, ownershipEstimateMissing, resaleEstimate };
}

export function comparisonMissingFields(product: ConsideredProductView) {
  const missing: string[] = [];
  if (product.estimatedPrice === null || product.estimatedPrice === undefined) missing.push("estimated cost");
  if (product.plannedOwnershipMonths === null || product.plannedOwnershipMonths === undefined) missing.push("planned ownership period");
  if (product.expectedWarrantyMonths === null || product.expectedWarrantyMonths === undefined) missing.push("expected warranty period");
  if (!product.repairabilityNotes?.trim()) missing.push("repairability notes");
  if (!product.resaleEstimate) missing.push("resale estimate");
  return missing;
}

export function compareConsideredProducts(products: ConsideredProductView[]) {
  if (products.length !== 2) return null;
  return {
    products: products.map(product => ({
      id: product.id,
      name: product.name,
      estimatedPrice: product.estimatedPrice,
      currency: product.currency ?? "USD",
      plannedOwnershipMonths: product.plannedOwnershipMonths,
      expectedWarrantyMonths: product.expectedWarrantyMonths,
      repairabilityNotes: product.repairabilityNotes,
      resaleEstimate: product.resaleEstimate,
      monthlyCost: product.monthlyCost,
      missing: comparisonMissingFields(product),
    })),
  };
}
