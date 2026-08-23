import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { invokeLLM } from "../_core/llm";

export const receiptFieldNames = [
  "name",
  "brand",
  "model",
  "category",
  "purchasedAt",
  "purchasePrice",
  "currency",
  "purchasedFrom",
  "invoiceNumber",
  "serialNumber",
  "warrantyMonths",
  "returnPeriodDays",
] as const;

export type ReceiptFieldName = (typeof receiptFieldNames)[number];

const nullableShortText = z.string().trim().max(255).nullable();
const extractionSchema = z.object({
  name: nullableShortText,
  brand: nullableShortText,
  model: nullableShortText,
  category: z.string().trim().max(80).nullable(),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  purchasePrice: z.number().min(0).max(99_999_999).nullable(),
  currency: z.string().trim().regex(/^[A-Za-z]{3}$/).nullable(),
  purchasedFrom: nullableShortText,
  invoiceNumber: nullableShortText,
  serialNumber: nullableShortText,
  warrantyMonths: z.number().int().min(0).max(240).nullable(),
  returnPeriodDays: z.number().int().min(0).max(365).nullable(),
  confidence: z.number().min(0).max(100),
  uncertainFields: z.array(z.enum(receiptFieldNames)),
});

export type ReceiptExtraction = z.infer<typeof extractionSchema> & {
  source: "ocr" | "llm" | "fallback";
  message?: string;
};

type OcrRead = { text: string; confidence: number };

export type ReceiptExtractionRun = {
  extraction: ReceiptExtraction;
  rawOcrText: string | null;
  ocrConfidence: number;
};

type OcrCandidate = OcrRead & {
  angle: number;
  psm: number;
  quality: number;
};

const emptyFields = (): Omit<ReceiptExtraction, "confidence" | "uncertainFields" | "source" | "message"> => ({
  name: null,
  brand: null,
  model: null,
  category: null,
  purchasedAt: null,
  purchasePrice: null,
  currency: null,
  purchasedFrom: null,
  invoiceNumber: null,
  serialNumber: null,
  warrantyMonths: null,
  returnPeriodDays: null,
});

const clampConfidence = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function fallbackReceiptExtraction(message = "We couldn't find readable text in this document. You can add the details yourself."): ReceiptExtraction {
  return {
    ...emptyFields(),
    confidence: 0,
    uncertainFields: [...receiptFieldNames],
    source: "fallback",
    message,
  };
}

function contentAsText(content: string | Array<{ type: "text"; text: string } | { type: string }>) {
  if (typeof content === "string") return content;
  return content.map(part => part.type === "text" && "text" in part ? part.text : "").join("");
}

export function parseReceiptExtraction(content: string, source: "ocr" | "llm" = "llm"): ReceiptExtraction {
  const response = JSON.parse(content) as Record<string, unknown>;
  const asText = (value: unknown, maxLength = 255) => typeof value === "string" && value.trim().length <= maxLength ? value.trim() || null : null;
  const asNumber = (value: unknown, min: number, max: number) => {
    const parsedValue = typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[^0-9.,-]/g, "").replace(",", ".")) : NaN;
    return Number.isFinite(parsedValue) && parsedValue >= min && parsedValue <= max ? parsedValue : null;
  };
  const rawDate = asText(response.purchasedAt, 32);
  const normalizedDate = rawDate && /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(rawDate)
    ? (() => {
      const [first, second, yearPart] = rawDate.split(/[/-]/).map(Number);
      const year = yearPart < 100 ? 2000 + yearPart : yearPart;
      const month = first > 12 ? second : first;
      const day = first > 12 ? first : second;
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    })()
    : rawDate;
  const rawConfidence = asNumber(response.confidence, 0, 100);
  const normalized = {
    name: asText(response.name),
    brand: asText(response.brand),
    model: asText(response.model),
    category: asText(response.category, 80),
    purchasedAt: normalizedDate,
    purchasePrice: asNumber(response.purchasePrice, 0, 99_999_999),
    currency: asText(response.currency, 3)?.toUpperCase() ?? null,
    purchasedFrom: asText(response.purchasedFrom),
    invoiceNumber: asText(response.invoiceNumber),
    serialNumber: asText(response.serialNumber),
    warrantyMonths: (() => { const value = asNumber(response.warrantyMonths, 0, 240); return value !== null && Number.isInteger(value) ? value : null; })(),
    returnPeriodDays: (() => { const value = asNumber(response.returnPeriodDays, 0, 365); return value !== null && Number.isInteger(value) ? value : null; })(),
    confidence: rawConfidence !== null && rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence ?? 0,
    uncertainFields: Array.isArray(response.uncertainFields)
      ? response.uncertainFields.filter((field): field is ReceiptFieldName => typeof field === "string" && (receiptFieldNames as readonly string[]).includes(field))
      : [],
  };
  const parsed = extractionSchema.safeParse(normalized);
  if (!parsed.success) throw new Error(`The extraction response did not match the expected receipt format: ${parsed.error.issues.map(issue => issue.path.join(".") || issue.message).join(", ")}`);
  const data = parsed.data;
  const uncertain = new Set<ReceiptFieldName>(data.uncertainFields);
  for (const field of receiptFieldNames) {
    if (data[field] === null) uncertain.add(field);
  }
  return {
    ...data,
    confidence: clampConfidence(data.confidence),
    currency: data.currency?.toUpperCase() ?? null,
    uncertainFields: Array.from(uncertain),
    source,
  };
}

function processResult(command: string, args: string[], timeoutMs = 60_000) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${command} took too long to read this receipt.`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} could not read this document${stderr ? `: ${stderr.trim()}` : ""}`));
    });
  });
}

function parseTsv(tsv: string): OcrRead {
  const lines = new Map<string, string[]>();
  const confidences: number[] = [];
  for (const row of tsv.split(/\r?\n/).slice(1)) {
    const columns = row.split("\t");
    if (columns.length < 12) continue;
    const text = columns.slice(11).join("\t").trim();
    const confidence = Number(columns[10]);
    if (!text) continue;
    if (Number.isFinite(confidence) && confidence >= 0) confidences.push(confidence);
    const lineKey = columns.slice(1, 5).join(":");
    const words = lines.get(lineKey) ?? [];
    words.push(text);
    lines.set(lineKey, words);
  }
  const text = Array.from(lines.values()).map(words => words.join(" ")).join("\n").trim();
  const confidence = confidences.length ? confidences.reduce((total, value) => total + value, 0) / confidences.length : 0;
  return { text, confidence: clampConfidence(confidence) };
}

async function preprocessImage(sourcePath: string, targetPath: string, angle: number) {
  let image = sharp(sourcePath, { failOn: "none" }).autoOrient();
  if (angle !== 0) image = image.rotate(angle);
  await image
    .flatten({ background: "#ffffff" })
    .resize({ width: 2_000, height: 3_000, fit: "inside", withoutEnlargement: false })
    .grayscale()
    .normalise({ lower: 1, upper: 99 })
    .sharpen({ sigma: 1 })
    .png({ compressionLevel: 6 })
    .toFile(targetPath);
}

async function renderFirstPdfPage(pdfPath: string, outputBase: string) {
  await processResult("pdftoppm", ["-png", "-singlefile", "-f", "1", "-l", "1", "-r", "200", pdfPath, outputBase]);
  return `${outputBase}.png`;
}

async function readTesseractCandidate(imagePath: string, psm: number): Promise<OcrRead> {
  const result = await processResult("tesseract", [imagePath, "stdout", "--oem", "1", "--psm", String(psm), "-l", "eng", "tsv"], 25_000);
  return parseTsv(result.stdout);
}

function ocrQuality(read: OcrRead) {
  const words = read.text.match(/[A-Za-z0-9]{2,}/g) ?? [];
  const meaningful = words.filter(word => /[A-Za-z]/.test(word) || /\d/.test(word)).length;
  const receiptCues = read.text.match(/\b(?:total|invoice|receipt|bill|date|amount|tax|gst|gstin|cash|order|payment|net\s+payable|amount\s+payable)\b/gi)?.length ?? 0;
  const dateCues = read.text.match(/\b(?:20\d{2}[-/.](?:0?[1-9]|1[0-2])[-/.](?:0?[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])[-/.](?:0?[1-9]|1[0-2])[-/.]20\d{2}|(?:0?[1-9]|[12]\d|3[01])\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b/gi)?.length ?? 0;
  const moneyCues = read.text.match(/(?:[$€£₹¥]|\b(?:USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|Rs\.?)\s*)?\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})\b/gi)?.length ?? 0;
  const noisyCharacters = read.text.match(/[^A-Za-z0-9\s.,:/#&$€£₹¥()\-]/g)?.length ?? 0;
  const quality = read.confidence * 0.55
    + Math.min(18, meaningful * 0.45)
    + Math.min(18, receiptCues * 4)
    + Math.min(12, dateCues * 6)
    + Math.min(8, moneyCues * 1.5)
    + Math.min(10, read.text.trim().length / 30)
    - Math.min(18, noisyCharacters * 0.75);
  return Math.round(quality);
}

function isStrongOcrCandidate(candidate: OcrCandidate) {
  return candidate.quality >= 72 && candidate.confidence >= 52 && candidate.text.length >= 80;
}

async function readReceiptText(input: { bytes: Buffer; mimeType: string }): Promise<OcrRead> {
  const workDir = join(tmpdir(), `stashly-receipt-${randomUUID()}`);
  await mkdir(workDir, { recursive: true });
  try {
    const extension = input.mimeType === "application/pdf" ? "pdf" : input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
    const originalPath = join(workDir, `source.${extension}`);
    await writeFile(originalPath, input.bytes);
    const sourceImage = input.mimeType === "application/pdf"
      ? await renderFirstPdfPage(originalPath, join(workDir, "receipt-page"))
      : originalPath;
    let best: OcrCandidate = { text: "", confidence: 0, angle: 0, psm: 6, quality: 0 };
    for (const angle of [0, 90, 180, 270]) {
      const processedPath = join(workDir, `prepared-${angle}.png`);
      await preprocessImage(sourceImage, processedPath, angle);
      let bestAtAngle: OcrCandidate | null = null;
      for (const psm of [4, 6, 11, 12]) {
        const read = await readTesseractCandidate(processedPath, psm);
        const candidate: OcrCandidate = { ...read, angle, psm, quality: ocrQuality(read) };
        if (candidate.quality > best.quality) best = candidate;
        if (!bestAtAngle || candidate.quality > bestAtAngle.quality) bestAtAngle = candidate;
      }
      if (angle === 0 && bestAtAngle && (isStrongOcrCandidate(bestAtAngle) || (bestAtAngle.confidence >= 45 && bestAtAngle.text.length >= 80 && bestAtAngle.quality >= 58))) return bestAtAngle;
    }
    return best;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

const monthIndex: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

function numericReceiptDate(first: number, second: number, year: string, text: string) {
  if (first > 12 && second <= 12) return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  if (second > 12 && first <= 12) return `${year}-${String(first).padStart(2, "0")}-${String(second).padStart(2, "0")}`;
  if (hasIndianCurrencyEvidence(text)) return `${year}-${String(second).padStart(2, "0")}-${String(first).padStart(2, "0")}`;
  return null;
}

function isoDateFromText(text: string) {
  const direct = text.match(/\b(20\d{2})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])\b/);
  if (direct) return `${direct[1]}-${direct[2].padStart(2, "0")}-${direct[3].padStart(2, "0")}`;
  const named = text.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[,\s]+(20\d{2})\b/i);
  if (named) return `${named[3]}-${monthIndex[named[2].slice(0, 3).toLowerCase()]}-${named[1].padStart(2, "0")}`;
  const dateLine = text.split(/\r?\n/).find(line => /\b(?:purchase\s+date|invoice\s+date|date|dated)\b/i.test(line) && !/\b(?:valid|warranty|return|expiry|expires)\b/i.test(line));
  const labelled = dateLine?.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (labelled) return numericReceiptDate(Number(labelled[1]), Number(labelled[2]), labelled[3], text);
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (numeric) return numericReceiptDate(Number(numeric[1]), Number(numeric[2]), numeric[3], text);
  return null;
}

function hasIndianCurrencyEvidence(text: string) {
  if (/(?:₹|\b(?:INR|Rs\.?|rupees?|GSTIN)\b)/i.test(text)) return true;
  // A GST rate plus a six-digit Indian postal address is sufficient context only
  // when OCR has visibly merged the ₹ symbol into the printed amount.
  return /\bGST\b/i.test(text)
    && /\b(?:5|12|18|28)\s*%/i.test(text)
    && /\b[1-9]\d{5}\b/.test(text);
}

function currencyFromText(text: string) {
  const explicit = text.match(/\b(USD|EUR|GBP|INR|CAD|AUD|JPY|CNY)\b/i)?.[1];
  if (explicit) return explicit.toUpperCase();
  if (/\b(?:rs\.?|rupees?)\b/i.test(text)) return "INR";
  if (text.includes("₹")) return "INR";
  if (hasIndianCurrencyEvidence(text)) return "INR";
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("¥")) return "JPY";
  return null;
}

const genericProductLeadWords = new Set([
  "wireless", "bluetooth", "gaming", "usb", "portable", "smart", "digital", "premium", "new", "the", "a", "an",
]);

function productCategoryFromName(name: string | null) {
  if (!name) return null;
  if (/\b(?:laptop|notebook|desktop|computer)\b/i.test(name)) return "Electronics / Computers";
  if (/\b(?:phone|smartphone|mobile)\b/i.test(name)) return "Electronics / Mobile";
  if (/\b(?:headphones?|earbuds?|speaker|soundbar)\b/i.test(name)) return "Electronics / Audio";
  if (/\b(?:mouse|keyboard|webcam|monitor|dock|usb\s*hub)\b/i.test(name)) return "Electronics";
  if (/\b(?:refrigerator|washing\s*machine|microwave|air\s*conditioner|vacuum|appliance)\b/i.test(name)) return "Home Appliance";
  if (/\b(?:chair|table|desk|sofa|bed|furniture)\b/i.test(name)) return "Furniture";
  return null;
}

function brandFromProductName(name: string | null) {
  if (!name) return null;
  const words = name.match(/[A-Za-z][A-Za-z0-9-]*/g) ?? [];
  const first = words[0];
  const remainder = words.slice(1).join(" ");
  if (!first || genericProductLeadWords.has(first.toLowerCase()) || !productCategoryFromName(remainder)) return null;
  return first;
}

const receiptAmountPattern = /(?:[$€£₹¥]|\b(?:USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|Rs\.?)\s*)?(?:\d{1,3}(?:[,.]\d{3})+(?:[.,]\d{2})?|\d+(?:[.,]\d{2}))/i;

function hasUnambiguousTrailingQuantityArtifact(value: string, rawLine: string, receiptText: string) {
  if (!/\b(?:qty|quantity)\b/i.test(receiptText) || !/\s1$/.test(value)) return false;
  const amountSuffix = "(?:[$€£₹¥]|\\b(?:USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|Rs\\.?)\\s*)?\\d{1,3}(?:[,.]\\d{3})*(?:[.,]\\d{2})?";
  const terminalProductNoun = /\b(?:mouse|keyboard|headphones?|earbuds?|speaker|monitor|webcam|camera)\s+1\s*$/i.test(value);
  const preservesModelNumber = new RegExp(`\\b\\d{1,6}\\s+1\\s+${amountSuffix}\\s*$`, "i").test(rawLine);
  return terminalProductNoun || preservesModelNumber;
}

function cleanProductName(value: string, removeQuotedQuantity = false, receiptText = "", rawLine = "") {
  const hadTrailingQuoteNoise = /["“”`]+\s*$/.test(value);
  let cleaned = value.replace(/["“”`]+\s*$/g, "").replace(/\s{2,}/g, " ").trim();
  // A quantity directly before an OCR quote is safe to remove only from a
  // line-item whose price has already been stripped. This preserves genuine
  // names such as "Product 2" when there is no trailing OCR artifact. An
  // unquoted trailing 1 is removed only when a quantity heading and a known
  // terminal product noun make the line-item quantity unambiguous.
  if (removeQuotedQuantity && (hadTrailingQuoteNoise || hasUnambiguousTrailingQuantityArtifact(cleaned, rawLine, receiptText))) cleaned = cleaned.replace(/\s+1\s*$/, "");
  return cleaned;
}

function productNameFromText(text: string) {
  const labelled = text.match(/(?:item|product|description|particulars)\s*[:\-]\s*([^\n]{5,255})/i)?.[1]?.trim();
  if (labelled && !/\b(?:total|tax|gst|amount\s+due|payment|invoice|serial|sku|barcode)\b/i.test(labelled)) return cleanProductName(labelled);
  const productLine = text.split(/\r?\n/).map(line => line.trim()).find(line => {
    const letters = line.replace(/[^A-Za-z]/g, "").length;
    const hasAmount = receiptAmountPattern.test(line);
    return letters >= 6 && hasAmount && !/\b(?:subtotal|grand\s+total|total|tax|gst|amount\s+due|balance\s+due|payment|cash|change|visa|mastercard|invoice|serial|sku|barcode)\b/i.test(line);
  });
  if (!productLine) return null;
  const withoutPrice = productLine.replace(new RegExp(receiptAmountPattern.source, "gi"), "").replace(/\s{2,}/g, " ").trim();
  const cleaned = cleanProductName(withoutPrice, true, text, productLine);
  const words = cleaned.match(/[A-Za-z0-9]+/g) ?? [];
  return cleaned.length >= 5 && words.length >= 2 ? cleaned.slice(0, 255) : null;
}

function receiptAmountFromToken(token: string) {
  const normalized = token.replace(/[^0-9.,]/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function totalFromText(text: string) {
  const totalLine = text.split(/\r?\n/).filter(line => /\b(?:grand\s+)?total\b|net\s+payable|amount\s+payable|amount\s+due|balance\s+due/i.test(line) && !/\bsubtotal\b/i.test(line)).at(-1);
  if (!totalLine) return null;
  const cleaned = totalLine
    .replace(/(?:[$€£₹¥~]|\b(?:USD|EUR|GBP|INR|CAD|AUD|JPY|CNY|Rs\.?)\b)/gi, " ")
    .replace(/\s+/g, " ");
  const amount = cleaned.match(/\b(?:\d{1,3}(?:[,.]\d{3})*(?:[.,]\d{2})|\d+(?:[.,]\d{2}))\b/g)?.at(-1);
  if (!amount) return null;

  // Tesseract can join a rupee symbol to the amount as a leading "2". Correct
  // only this exact Indian-receipt artifact on a labelled total, never on line items.
  const repairedIndianAmount = hasIndianCurrencyEvidence(text)
    ? amount.match(/^2(\d{1,3},\d{3}\.\d{2})$/)?.[1] ?? amount
    : amount;
  return receiptAmountFromToken(repairedIndianAmount);
}

function compactReceiptValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isIdentifierLike(value: string) {
  const compact = compactReceiptValue(value);
  const letters = (compact.match(/[a-z]/g) ?? []).length;
  const digits = (compact.match(/\d/g) ?? []).length;
  return (letters > 0 && digits > 0 && compact.length >= 5 && !/\s/.test(value))
    || /^\d{6,}$/.test(compact)
    || /\b(?:serial|s\/?n|imei|device\s*id|product\s*id|invoice|receipt|bill|order|sku|barcode|gstin|tax\s*id|phone)\b/i.test(value);
}

function retailerCandidate(value: string | null) {
  if (!value) return null;
  const candidate = value.replace(/^[-:#\s]+/, "").trim();
  const letters = candidate.replace(/[^A-Za-z]/g, "").length;
  const words = candidate.match(/[A-Za-z]{2,}/g) ?? [];
  if (candidate.length < 4 || letters < 4 || words.length < 2 || isIdentifierLike(candidate)) return null;
  if (/\b(?:invoice|receipt|serial|sku|barcode|gstin|tax\s*(?:id|invoice)|phone|mobile|total|subtotal|date|time|qty|price)\b/i.test(candidate)) return null;
  return candidate;
}

function retailerFromText(text: string) {
  const labelled = text.match(/(?:retailer|seller|store\s*name|sold\s*by|m\/?s\.?|dealer)\s*[:\-]\s*([^\n]{4,255})/i)?.[1]?.trim();
  const labelledRetailer = retailerCandidate(labelled ?? null);
  if (labelledRetailer) return labelledRetailer;
  return text.split(/\r?\n/).slice(0, 6).map(line => retailerCandidate(line.trim())).find((candidate): candidate is string => candidate !== null) ?? null;
}

function matchNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  const value = match?.[1] ?? match?.[2];
  return value ? Number(value) : null;
}

function directTextFact(text: string, label: string, maxLength = 255) {
  const value = text.match(new RegExp(`(?:^|\\n)\\s*${label}\\s*[:#-]\\s*([^\\n]{1,${maxLength}})`, "im"))?.[1]?.trim() ?? null;
  return value && !/\b(?:not\s+available|n\/?a)\b/i.test(value) ? value : null;
}

function evidenceBackedText(value: string | null, text: string) {
  if (!value) return null;
  const normalizedValue = compactReceiptValue(value);
  const normalizedText = compactReceiptValue(text);
  return normalizedValue.length >= 3 && normalizedText.includes(normalizedValue) ? value : null;
}

function extractionConfidence(ocrConfidence: number, fields: Pick<ReceiptExtraction, ReceiptFieldName>) {
  const important: ReceiptFieldName[] = ["name", "purchasedAt", "purchasePrice", "currency", "purchasedFrom", "invoiceNumber"];
  const evidenceCount = important.filter(field => fields[field] !== null).length;
  const value = ocrConfidence * 0.68 + evidenceCount * 5.3;
  return clampConfidence((fields.purchasePrice === null || fields.purchasedAt === null) ? Math.min(value, 64) : value);
}

/** A no-network structured fallback when OCR text is readable but the interpretation model is unavailable. */
export function extractReceiptFieldsFromText(text: string, confidence = 0): ReceiptExtraction {
  const currency = currencyFromText(text);
  const name = productNameFromText(text);
  const data = {
    ...emptyFields(),
    name,
    brand: directTextFact(text, "brand") ?? brandFromProductName(name),
    model: directTextFact(text, "(?:model|model\\s*no|model\\s*number)"),
    category: directTextFact(text, "category", 80) ?? productCategoryFromName(name),
    purchasedAt: isoDateFromText(text),
    purchasePrice: totalFromText(text),
    currency,
    purchasedFrom: retailerFromText(text),
    invoiceNumber: text.match(/(?:invoice|receipt|transaction|bill|cash\s*memo|tax\s*invoice|order)(?:\s*(?:no|number|#|id))?\s*[:#-]?\s*([A-Z0-9/-]{4,})/i)?.[1] ?? null,
    serialNumber: text.match(/(?:serial|s\/n|sn|imei|device\s*id|product\s*id)(?:\s*(?:no|number|#))?\s*[:#-]?\s*([A-Z0-9/-]{4,})/i)?.[1] ?? null,
    warrantyMonths: matchNumber(text, /(?:warranty|coverage)\D{0,18}(\d{1,3})\s*(?:month|months)/i),
    returnPeriodDays: matchNumber(text, /(?:(\d{1,3})\s*(?:day|days)\s*(?:return|returns)|(?:return|returns)\D{0,24}(\d{1,3})\s*(?:day|days))/i),
  };
  const uncertain = receiptFieldNames.filter(field => data[field] === null);
  return {
    ...data,
    confidence: extractionConfidence(confidence, data),
    uncertainFields: uncertain,
    source: "ocr",
    message: "Text was read with OCR. Please check every field before saving.",
  };
}

function mergeEvidenceBackedExtraction(structured: ReceiptExtraction, text: string, ocrConfidence: number): ReceiptExtraction {
  const directFacts = extractReceiptFieldsFromText(text, ocrConfidence);
  const canonicalFields: ReceiptFieldName[] = ["name", "purchasedAt", "purchasePrice", "currency", "invoiceNumber", "serialNumber", "warrantyMonths", "returnPeriodDays"];
  const merged = { ...structured } as ReceiptExtraction;
  for (const field of canonicalFields) merged[field] = directFacts[field] as never;
  merged.name = directFacts.name;
  merged.brand = directFacts.brand ?? evidenceBackedText(structured.brand, text);
  merged.model = directFacts.model;
  merged.category = directFacts.category
    ?? evidenceBackedText(structured.category, text)
    ?? productCategoryFromName(merged.name);
  merged.purchasedFrom = directFacts.purchasedFrom ?? retailerCandidate(evidenceBackedText(structured.purchasedFrom, text));
  const uncertain = new Set<ReceiptFieldName>(structured.uncertainFields);
  for (const field of receiptFieldNames) {
    if (merged[field] === null) uncertain.add(field);
    else uncertain.delete(field);
  }
  return {
    ...merged,
    confidence: extractionConfidence(ocrConfidence, merged),
    uncertainFields: Array.from(uncertain),
    source: "ocr",
    message: "Text was read with OCR. Please check every field before saving.",
  };
}

/** Reconciles older stored review payloads with their retained raw OCR evidence. */
export function normalizeStoredReceiptExtraction(extraction: ReceiptExtraction, rawOcrText: string | null | undefined): ReceiptExtraction {
  return rawOcrText?.trim() ? mergeEvidenceBackedExtraction(extraction, rawOcrText, extraction.confidence) : extraction;
}

async function structureOcrText(text: string, ocrConfidence: number): Promise<ReceiptExtraction> {
  try {
    const response = await invokeLLM({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You extract receipt facts from OCR text. Only return values explicitly printed in the OCR text. Never infer, estimate, complete, or fabricate a field. Return null for unavailable data and list every unavailable value in uncertainFields. A category may only be returned if explicitly named. Dates must be YYYY-MM-DD. Currency must be a three-letter ISO code only when printed or unambiguous from a printed currency symbol. Product names must be a printed purchased item, not the retailer.",
        },
        { role: "user", content: `Read this OCR text from one purchase receipt or invoice and extract review-form facts. Return one complete JSON object only.\n\nOCR TEXT:\n${text}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt_extraction",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: ["string", "null"] }, brand: { type: ["string", "null"] }, model: { type: ["string", "null"] }, category: { type: ["string", "null"] },
              purchasedAt: { type: ["string", "null"] }, purchasePrice: { type: ["number", "null"] }, currency: { type: ["string", "null"] }, purchasedFrom: { type: ["string", "null"] },
              invoiceNumber: { type: ["string", "null"] }, serialNumber: { type: ["string", "null"] }, warrantyMonths: { type: ["integer", "null"] }, returnPeriodDays: { type: ["integer", "null"] },
              confidence: { type: "number" }, uncertainFields: { type: "array", items: { type: "string", enum: [...receiptFieldNames] } },
            },
            required: ["name", "brand", "model", "category", "purchasedAt", "purchasePrice", "currency", "purchasedFrom", "invoiceNumber", "serialNumber", "warrantyMonths", "returnPeriodDays", "confidence", "uncertainFields"],
            additionalProperties: false,
          },
        },
      },
    });
    const content = response.choices[0]?.message.content;
    if (!content) throw new Error("The interpretation service returned no content.");
    const structured = parseReceiptExtraction(contentAsText(content), "ocr");
    return mergeEvidenceBackedExtraction(structured, text, ocrConfidence);
  } catch (error) {
    console.warn("[Stashly receipt OCR structuring]", error);
    return extractReceiptFieldsFromText(text, ocrConfidence);
  }
}

/**
 * Runs local Tesseract against the actual uploaded bytes, after rotation-aware
 * preprocessing. A text-only language-model pass merely structures recognized
 * text; it never receives or invents unrecognized receipt data.
 */
export async function extractReceiptWithDiagnostics(input: { bytes: Buffer; mimeType: string }): Promise<ReceiptExtractionRun> {
  try {
    const read = await readReceiptText(input);
    if (process.env.NODE_ENV !== "production") {
      console.info("[Stashly receipt OCR diagnostic]", {
        mimeType: input.mimeType,
        byteCount: input.bytes.length,
        textCharacters: read.text.trim().length,
        textLines: read.text.trim() ? read.text.trim().split(/\r?\n/).length : 0,
        confidence: read.confidence,
      });
    }
    if (read.text.trim().length < 8) return { extraction: fallbackReceiptExtraction(), rawOcrText: read.text || null, ocrConfidence: read.confidence };
    const extraction = await structureOcrText(read.text, read.confidence);
    if (process.env.NODE_ENV !== "production") {
      console.info("[Stashly receipt OCR diagnostic]", {
        source: extraction.source,
        confidence: extraction.confidence,
        populatedFieldCount: receiptFieldNames.filter(field => extraction[field] !== null).length,
        uncertainFieldCount: extraction.uncertainFields.length,
      });
    }
    return { extraction, rawOcrText: read.text, ocrConfidence: read.confidence };
  } catch (error) {
    console.warn("[Stashly receipt OCR]", error);
    return { extraction: fallbackReceiptExtraction("We couldn't complete OCR for this document. You can still add the details yourself."), rawOcrText: null, ocrConfidence: 0 };
  }
}

export async function extractReceiptFromUpload(input: { bytes: Buffer; mimeType: string }): Promise<ReceiptExtraction> {
  return (await extractReceiptWithDiagnostics(input)).extraction;
}
