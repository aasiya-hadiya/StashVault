import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ArrowUpRight, BellRing, CalendarDays, Camera, ChevronRight, CircleAlert, Download, Eye, FileText, Filter, Loader2, LockKeyhole, LogOut, Package, Plus, Receipt, Search, ShieldCheck, Sparkles, Trash2, Upload, UserRound } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChevronLink, EmptyState, MiniMetric, ProductCard, SectionHeading, StatusBadge } from "./Primitives";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { receiptFileInputSettings, validateReceiptCandidate } from "./receiptFileSelection";
import { getReceiptFieldEvidenceStatus, getReceiptReviewState } from "./receiptReviewState";
import { repairPageState, repairRecommendation, returnPresentation, sortProductsForRepair, warrantyPresentation } from "./repairLifecycle";
import { assistantHistoryForAttempt, safeAssistantFailureMessage } from "./assistantConversation";
import "./beforeBuy.css";

type ProductRecord = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  purchasedAt?: Date | string | null;
  purchasePrice?: number | null;
  warrantyDaysRemaining?: number | null;
  returnDaysRemaining?: number | null;
  warrantyStatus: "protected" | "expiring" | "expired" | "review_needed";
  returnStatus: "active" | "expiring" | "expired" | "review_needed";
  urgency: "none" | "soon" | "attention";
  warrantyMonths?: number | null;
  warrantyStartsAt?: Date | string | null;
  warrantyExpiresAt?: Date | string | null;
  returnPeriodDays?: number | null;
  returnStartsAt?: Date | string | null;
  returnExpiresAt?: Date | string | null;
  notes?: string | null;
  purchasedFrom?: string | null;
  serialNumber?: string | null;
};

type DocumentRecord = {
  id: number;
  productId?: number | null;
  name: string;
  fileName?: string | null;
  documentType: "invoice" | "receipt" | "warranty" | "service_record" | "manual" | "order_confirmation" | "other";
  mimeType?: string | null;
  processingStatus: "not_requested" | "queued" | "processing" | "completed" | "failed";
  extractionReviewedAt?: Date | string | null;
  createdAt: Date | string;
};

type UploadDocumentType = "invoice" | "receipt" | "warranty" | "service_record" | "other";

type ReceiptExtractionRecord = {
  name: string | null; brand: string | null; model: string | null; category: string | null; purchasedAt: string | null; purchasePrice: number | null; currency: string | null; purchasedFrom: string | null; invoiceNumber: string | null; serialNumber: string | null; warrantyMonths: number | null; returnPeriodDays: number | null; confidence: number; uncertainFields: string[]; source: "ocr" | "llm" | "fallback"; message?: string;
};
type ReceiptReviewRecord = DocumentRecord & { extraction?: ReceiptExtractionRecord; extractionError?: string | null; extractionReviewedAt?: Date | string | null };

function ClaimAssistantPanel({ productId }: { productId: number }) {
  const status = trpc.claimAssistant.status.useQuery({ productId });
  const generate = trpc.claimAssistant.generate.useMutation();
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [request, setRequest] = useState("");
  const [editingRequest, setEditingRequest] = useState(false);
  const [copied, setCopied] = useState(false);

  const createRequest = async () => {
    const result = await generate.mutateAsync({ productId, issue });
    setRequest(result.request);
    setEditingRequest(false);
    setCopied(false);
  };
  const copyRequest = async () => {
    if (!request) return;
    try {
      await navigator.clipboard?.writeText(request);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  if (!open) return <section className="claim-assistant claim-assistant--prompt"><div><span className="eyebrow">Need a hand?</span><h2>Something’s wrong?</h2><p>Gather the records you already have and prepare a clear request for support.</p></div><button type="button" className="button button--dark" onClick={() => setOpen(true)}><CircleAlert size={16} /> Start a claim</button></section>;

  const checklist = status.data?.checklist ?? [];
  return <section className="claim-assistant" aria-labelledby="claim-assistant-title"><div className="claim-assistant__heading"><div><span className="eyebrow">Warranty assistant</span><h2 id="claim-assistant-title">Prepare your next step.</h2><p>This draft uses only saved product details and the issue you describe. Review it before sending.</p></div><button type="button" className="button button--quiet" onClick={() => setOpen(false)}>Close</button></div>{status.isLoading ? <SoftLoading label="Checking your saved coverage…" /> : status.isError ? <SoftError retry={() => status.refetch()} copy="We couldn't check this coverage right now." /> : <><div className="claim-warranty-status"><StatusBadge status={status.data?.warranty.status === "expired" ? "expired" : status.data?.warranty.status === "review_needed" ? "neutral" : status.data?.warranty.status === "expiring" ? "watch" : "safe"}>{status.data?.warranty.label}</StatusBadge><p>{status.data?.warranty.detail}</p></div><div className="claim-checklist"><h3>Before you contact support</h3>{checklist.map(item => <div className="claim-checklist__item" key={item.key}><ShieldCheck size={17} aria-hidden="true" className={item.status === "available" ? "claim-checklist__icon claim-checklist__icon--available" : "claim-checklist__icon"} /><div><strong>{item.label}</strong><span>{item.detail}</span></div><em className={`claim-checklist__state claim-checklist__state--${item.status}`}>{item.status === "available" ? "Available" : item.status === "expired" ? "Expired" : item.status === "missing" ? "Missing" : "Review needed"}</em></div>)}</div><label className="auth-field claim-assistant__issue">What went wrong?<textarea value={issue} onChange={event => setIssue(event.target.value)} placeholder="Describe the fault, when it started, and what you have tried." maxLength={2000} /></label>{generate.isError && <p className="form-error">{generate.error.message || "We couldn't prepare that request. Please try again."}</p>}<button type="button" className="button button--primary" disabled={issue.trim().length < 3 || generate.isPending} onClick={() => void createRequest()}>{generate.isPending ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}{request ? "Regenerate request" : "Generate request"}</button>{request && <div className="claim-request"><div className="claim-request__header"><div><span className="eyebrow">Your service request</span><h3>Ready to review.</h3></div><div className="claim-request__actions"><button type="button" className="button button--quiet" onClick={() => setEditingRequest(current => !current)}>{editingRequest ? "Done editing" : "Edit request"}</button><button type="button" className="button button--dark" onClick={() => void copyRequest()}>{copied ? "Copied" : "Copy request"}</button></div></div><textarea aria-label="Generated service request" value={request} readOnly={!editingRequest} onChange={event => setRequest(event.target.value)} /></div>}</>}</section>;
}

const productKinds = ["laptop", "headphones", "phone", "camera", "package"] as const;
const tones = ["sage", "blush", "lavender", "sand"] as const;

function formatDate(value?: Date | string | null) {
  if (!value) return "Date not saved";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not saved" : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(value?: Date | string | null) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function productKind(product: ProductRecord) {
  const label = `${product.name} ${product.category}`.toLowerCase();
  if (label.includes("laptop") || label.includes("macbook")) return "laptop";
  if (label.includes("headphone") || label.includes("sony") || label.includes("bose")) return "headphones";
  if (label.includes("phone") || label.includes("iphone")) return "phone";
  if (label.includes("camera") || label.includes("canon")) return "camera";
  return "package";
}

function warrantyBadgeForCard(product: ProductRecord) {
  if (product.warrantyStatus === "protected") return { status: "safe" as const, text: `Warranty · ${product.warrantyDaysRemaining ?? 0} days` };
  if (product.warrantyStatus === "expiring") return { status: "watch" as const, text: `Warranty · ${product.warrantyDaysRemaining ?? 0} days` };
  if (product.warrantyStatus === "review_needed") return { status: "neutral" as const, text: "Warranty · review needed" };
  return { status: "expired" as const, text: "Warranty · expired" };
}

function returnBadgeForCard(product: ProductRecord) {
  if (product.returnStatus === "active") return { status: "safe" as const, text: `Return · ${product.returnDaysRemaining ?? 0} days` };
  if (product.returnStatus === "expiring") return { status: "watch" as const, text: `Return · ${product.returnDaysRemaining ?? 0} days` };
  if (product.returnStatus === "review_needed") return { status: "neutral" as const, text: "Return · review needed" };
  return { status: "expired" as const, text: "Return · closed" };
}

function statusForCard(product: ProductRecord) {
  const warranty = warrantyBadgeForCard(product);
  const returns = returnBadgeForCard(product);
  return { ...warranty, secondaryStatus: returns.status, secondaryText: returns.text };
}

function SoftLoading({ label = "Opening your stash…" }: { label?: string }) {
  return <div className="stashly-data-state stashly-data-state--loading"><Loader2 size={22} /><span>{label}</span></div>;
}

function SoftError({ retry, copy = "We couldn't reach your stash right now. Please try again." }: { retry: () => void; copy?: string }) {
  return <div className="stashly-data-state stashly-data-state--error"><CircleAlert size={22} /><p>{copy}</p><button className="button button--dark button--small" onClick={retry}>Try again</button></div>;
}

const documentTypeLabel = (documentType: DocumentRecord["documentType"]) => ({ invoice: "Invoice", receipt: "Receipt", warranty: "Warranty", service_record: "Service record", manual: "Manual", order_confirmation: "Order confirmation", other: "Other" })[documentType];

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("We couldn't read that file. Please try again."));
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
    reader.readAsDataURL(file);
  });
}

function DocumentAccessButton({ document, mode }: { document: DocumentRecord; mode: "view" | "download" }) {
  const access = trpc.document.accessUrl.useQuery({ id: document.id }, { enabled: false, retry: false });
  const open = async () => {
    const preview = mode === "view" ? window.open("", "_blank", "noopener") : null;
    const result = await access.refetch();
    if (!result.data?.url) { preview?.close(); return; }
    if (mode === "view" && preview) preview.location.href = result.data.url;
    else {
      const link = window.document.createElement("a");
      link.href = result.data.url;
      link.download = result.data.fileName ?? document.fileName ?? document.name;
      link.target = "_blank";
      link.rel = "noopener";
      window.document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };
  const Icon = mode === "view" ? Eye : Download;
  return <button className="document-action" type="button" onClick={open} disabled={access.isFetching} aria-label={`${mode === "view" ? "View" : "Download"} ${document.name}`}><Icon size={14} />{mode === "view" ? "View" : "Download"}</button>;
}

function DocumentRow({ document, productName, onChanged }: { document: DocumentRecord; productName?: string; onChanged: () => void }) {
  const remove = trpc.document.delete.useMutation({ onSuccess: onChanged });
  const reviewedReceipt = document.documentType === "receipt" && !!document.extractionReviewedAt;
  return <div className="document-row document-row--managed"><span className="document-row__icon"><FileText size={16} /></span><span><strong>{document.name}{reviewedReceipt && <em className="receipt-field-status receipt-field-status--read document-review-mark">Review confirmed</em>}</strong><small>{documentTypeLabel(document.documentType)} · {formatDate(document.createdAt)}{productName ? ` · ${productName}` : ""}{reviewedReceipt ? " · OCR-reviewed" : ""}</small></span><div className="document-row__actions"><DocumentAccessButton document={document} mode="view" /><DocumentAccessButton document={document} mode="download" /><AlertDialog><AlertDialogTrigger asChild><button className="document-action document-action--danger" type="button" aria-label={`Remove ${document.name}`}><Trash2 size={14} />Remove</button></AlertDialogTrigger><AlertDialogContent className="stashly-confirm-dialog"><AlertDialogHeader><AlertDialogTitle>Remove this document?</AlertDialogTitle><AlertDialogDescription>It will be removed from this product’s paper trail. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep document</AlertDialogCancel><AlertDialogAction className="document-confirm-remove" onClick={() => remove.mutate({ id: document.id })}>{remove.isPending ? "Removing…" : "Remove document"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>{remove.isError && <p className="form-error document-row__error">We couldn't remove that document. Please try again.</p>}</div>;
}

function DocumentList({ documents, onChanged, productNames }: { documents: DocumentRecord[]; onChanged: () => void; productNames?: Map<number, string> }) {
  if (!documents.length) return <p className="quiet-panel-copy">No documents yet. Keep receipts, invoices, and warranty notes close when you have them.</p>;
  return <div className="document-list">{documents.map(document => <DocumentRow key={document.id} document={document} productName={document.productId ? productNames?.get(document.productId) : undefined} onChanged={onChanged} />)}</div>;
}

export function AccountGate({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated } = useAuth({ redirectOnUnauthenticated: true });
  if (loading) return <SoftLoading label="Opening your personal archive…" />;
  if (!isAuthenticated) return <SoftLoading label="Taking you to sign in…" />;
  return <>{children}</>;
}

export function ConnectedDashboard() {
  const query = trpc.dashboard.summary.useQuery();
  if (query.isLoading) return <SoftLoading />;
  if (query.isError || !query.data) return <SoftError retry={() => query.refetch()} />;
  const { totals, recentProducts, attention } = query.data;
  return <div className="page page--dashboard">
    <div className="page-topbar"><div><span className="eyebrow">Your ownership, at a glance</span><h1>Good to see you<span className="heading-period">.</span></h1></div><Link href="/add" className="button button--primary"><Plus size={17} /> Add to stash</Link></div>
    <section className="metric-row" aria-label="Warranty and return overview"><MiniMetric label="Warranty coverage" value={String(totals.protected)} note="Coverage still active" tone="sage" /><MiniMetric label="Returns ending soon" value={String(totals.returnsEndingSoon)} note="Within the next 3 days" tone="blush" /><MiniMetric label="Warranty expiring soon" value={String(totals.warrantiesExpiringSoon)} note="Within the next 30 days" tone="lavender" /><MiniMetric label="Items needing review" value={String(totals.itemsNeedingReview)} note="Coverage details to complete" tone="blush" /></section>
    <div className="dashboard-grid"><section className="panel panel--stash"><SectionHeading eyebrow="The things you keep" title="A little order, already." action={<ChevronLink href="/stash">See everything</ChevronLink>} />{recentProducts.length ? <div className="product-grid">{recentProducts.map((product, index) => { const status = statusForCard(product); return <ProductCard key={product.id} kind={productKind(product)} tone={tones[index % tones.length]} name={product.name} detail={`${product.category} · ${formatDate(product.purchasedAt)}`} status={status.status} statusText={status.text} secondaryStatus={status.secondaryStatus} secondaryStatusText={status.secondaryText} href={`/product/${product.id}`} />; })}</div> : <EmptyState title="Your archive is ready." copy="Add a first item, or explore a small private sample stash to see the rhythm." />}</section><section className="panel panel--attention"><SectionHeading eyebrow="A gentle nudge" title="Worth a look" />{attention.length ? <div className="attention-list">{attention.map(item => <Link key={item.id} href={`/product/${item.productId}`} className="attention-item"><span className="attention-item__icon attention-item__icon--peach"><CalendarDays size={17} /></span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={16} /></Link>)}</div> : <p className="quiet-panel-copy">Nothing needs your attention right now. That’s a lovely place to be.</p>}</section></div>
    <section className="insight-strip"><div className="insight-strip__icon"><Sparkles size={20} /></div><div><span className="eyebrow">A small thought from Stashly</span><p>“The best time to save a warranty is before you need it.”</p></div><Link href="/add" className="text-link">Add something useful <ArrowUpRight size={15} /></Link></section>
  </div>;
}

export function ConnectedStashPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const input = useMemo(() => ({ ...(search.trim() ? { search: search.trim() } : {}), ...(category ? { category } : {}) }), [search, category]);
  const query = trpc.product.list.useQuery(input);
  const seed = trpc.product.seedDemo.useMutation({ onSuccess: () => query.refetch() });
  const products = query.data ?? [];
  const categories = Array.from(new Set(products.map(product => product.category))).sort();
  return <div className="page"><div className="page-topbar"><div><span className="eyebrow">Your archive · {query.isLoading ? "…" : products.length} items</span><h1>My Stash<span className="heading-period">.</span></h1></div><Link href="/add" className="button button--primary"><Plus size={17} /> Add to stash</Link></div><div className="toolbar"><div className="search-field"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search your stash" aria-label="Search your stash" /></div><label className="toolbar-button"><Filter size={16} /><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter by category"><option value="">All categories</option>{categories.map(item => <option key={item} value={item}>{item}</option>)}</select></label></div>{query.isLoading ? <SoftLoading /> : query.isError ? <SoftError retry={() => query.refetch()} /> : products.length ? <section className="stash-catalog">{products.map((product, index) => { const status = statusForCard(product); return <ProductCard key={product.id} kind={productKind(product)} tone={tones[index % tones.length]} name={product.name} detail={`${product.category} · ${formatDate(product.purchasedAt)}`} status={status.status} statusText={status.text} secondaryStatus={status.secondaryStatus} secondaryStatusText={status.secondaryText} href={`/product/${product.id}`} />; })}</section> : <section className="panel stashly-empty-panel"><EmptyState title="A clear drawer is a lovely start." copy="Add your own first item, or load a small private sample stash to explore Stashly." /><button className="button button--quiet" disabled={seed.isPending} onClick={() => seed.mutate()}>{seed.isPending ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Explore a sample stash</button>{seed.isError && <p className="form-error">We couldn't add the sample stash. Please try again.</p>}</section>}</div>;
}

export function ConnectedRepairPage() {
  const query = trpc.product.list.useQuery();
  const products = sortProductsForRepair(query.data ?? []);
  const pageState = repairPageState(products);

  return <div className="page">
    <div className="page-topbar"><div><span className="eyebrow">Make it last</span><h1>Repair & Sustainability<span className="heading-period">.</span></h1></div></div>
    <section className="panel panel--soft repair-intro"><span className="eyebrow">A repair-first view</span><h2>Keep good things going.</h2><p>Repairing instead of replacing can help extend the life of your product.</p></section>
    {query.isLoading ? <SoftLoading label="Checking your saved product details…" /> : query.isError ? <SoftError retry={() => query.refetch()} copy="We couldn't load your saved products right now." /> : pageState === "products" ? <section className="panel repair-products-panel"><SectionHeading eyebrow="From your Stash" title="Products to keep in view." />
      <div className="repair-product-list">{products.map((product, index) => {
        const warranty = warrantyPresentation(product.warrantyStatus);
        const returns = returnPresentation(product.returnStatus);
        return <article className="repair-product" key={product.id}>
          <div className="repair-product__heading"><div><span className="eyebrow">Saved product</span><h3>{product.name}</h3><p>{product.brand || "Brand not saved"}</p></div><StatusBadge status={warranty.badge}>{warranty.label}</StatusBadge></div>
          <dl className="repair-product__facts"><div><dt>Purchase date</dt><dd>{formatDate(product.purchasedAt)}</dd></div><div><dt>Warranty expiry</dt><dd>{product.warrantyExpiresAt ? formatDate(product.warrantyExpiresAt) : "Not saved"}</dd></div><div><dt>Return status</dt><dd><StatusBadge status={returns.badge}>{returns.label}</StatusBadge></dd></div></dl>
          <div className="repair-product__next-step"><span className="eyebrow">Repair first</span><p>{repairRecommendation(product)}</p></div>
          <div className="repair-product__footer"><p>Repairing instead of replacing can help extend the life of your product.</p><Link href={`/product/${product.id}`} className="button button--quiet button--small">View Product <ArrowUpRight size={15} /></Link></div>
        </article>;
      })}</div>
    </section> : <section className="panel stashly-empty-panel"><EmptyState title="No products in your Stash yet." copy="Add a product to keep its purchase, warranty, return, and repair details close." cta="Add a product" href="/add" /></section>}
  </div>;
}

type SettingsProfileRecord = {
  displayName: string;
  email: string | null;
  notificationPreferences: {
    warrantyExpiry: boolean;
    returnPeriod: boolean;
    generalReminders: boolean;
  };
};

export function ConnectedSettingsPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const settings = trpc.settings.get.useQuery();
  const updateDisplayName = trpc.settings.updateDisplayName.useMutation({
    onSuccess: async profile => {
      setDisplayName(profile.displayName);
      setNameDirty(false);
      await Promise.all([settings.refetch(), utils.auth.me.invalidate()]);
    },
  });
  const updatePreferences = trpc.settings.updateNotificationPreferences.useMutation({
    onSuccess: async profile => {
      setPreferences(profile.notificationPreferences);
      setPreferencesDirty(false);
      await Promise.all([settings.refetch(), utils.dashboard.summary.invalidate()]);
    },
  });
  const [displayName, setDisplayName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [preferences, setPreferences] = useState<SettingsProfileRecord["notificationPreferences"] | null>(null);
  const [preferencesDirty, setPreferencesDirty] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const profile = settings.data as SettingsProfileRecord | undefined;
  const activePreferences = preferences ?? profile?.notificationPreferences ?? { warrantyExpiry: true, returnPeriod: true, generalReminders: true };

  useEffect(() => {
    if (profile && !nameDirty) setDisplayName(profile.displayName);
  }, [profile?.displayName, nameDirty]);

  useEffect(() => {
    if (profile && !preferencesDirty) setPreferences(profile.notificationPreferences);
  }, [profile?.notificationPreferences, preferencesDirty]);

  const saveDisplayName = (event: FormEvent) => {
    event.preventDefault();
    const value = displayName.trim();
    if (!value || value === profile?.displayName) return;
    updateDisplayName.mutate({ displayName: value });
  };

  const changePreference = (key: keyof SettingsProfileRecord["notificationPreferences"], checked: boolean) => {
    setPreferences(current => ({ ...(current ?? activePreferences), [key]: checked }));
    setPreferencesDirty(true);
  };

  const savePreferences = () => updatePreferences.mutate(activePreferences);

  const signOut = async () => {
    setSignOutError("");
    try {
      await logout();
      setLocation("/login");
    } catch {
      setSignOutError("We couldn't sign you out right now. Please try again.");
    }
  };

  if (settings.isLoading) return <SoftLoading label="Opening your account settings…" />;
  if (settings.isError || !profile) return <SoftError retry={() => settings.refetch()} copy="We couldn't open your account settings right now." />;

  return <div className="page settings-page">
    <div className="page-topbar"><div><span className="eyebrow">Your account</span><h1>Settings<span className="heading-period">.</span></h1></div></div>
    <div className="settings-layout">
      <section className="panel settings-panel" aria-labelledby="settings-profile-title">
        <div className="settings-panel__heading"><span className="settings-panel__icon"><UserRound size={18} /></span><div><span className="eyebrow">Profile</span><h2 id="settings-profile-title">The name on your archive.</h2><p>Choose the display name StashVault uses for you. Your signed-in email cannot be edited here.</p></div></div>
        <form className="product-form settings-form" onSubmit={saveDisplayName} noValidate>
          <div className="product-form__grid"><label className="auth-field">Display name<input value={displayName} onChange={event => { setDisplayName(event.target.value); setNameDirty(true); }} maxLength={120} autoComplete="name" /></label><label className="auth-field">Signed-in email<input value={profile.email ?? "Not available from your sign-in provider"} readOnly aria-readonly="true" /></label></div>
          {updateDisplayName.isError ? <p className="form-error">{updateDisplayName.error.message || "We couldn't save that name. Please try again."}</p> : null}
          {updateDisplayName.isSuccess && !nameDirty ? <p className="settings-success">Display name saved.</p> : null}
          <div className="form-actions"><button className="button button--primary" type="submit" disabled={!displayName.trim() || displayName.trim() === profile.displayName || updateDisplayName.isPending}>{updateDisplayName.isPending ? <Loader2 className="spin" size={16} /> : <UserRound size={16} />} Save display name</button></div>
        </form>
      </section>

      <section className="panel settings-panel" aria-labelledby="settings-notifications-title">
        <div className="settings-panel__heading"><span className="settings-panel__icon settings-panel__icon--sage"><BellRing size={18} /></span><div><span className="eyebrow">Notifications</span><h2 id="settings-notifications-title">Keep only the nudges you want.</h2><p>These preferences control the in-app attention reminders StashVault generates from your saved records.</p></div></div>
        <fieldset className="settings-preferences" disabled={updatePreferences.isPending}><legend className="visually-hidden">Notification preferences</legend><label className="settings-toggle"><span><strong>Warranty expiry</strong><small>Show alerts when evidence-backed warranty coverage is close to ending.</small></span><input type="checkbox" checked={activePreferences.warrantyExpiry} onChange={event => changePreference("warrantyExpiry", event.target.checked)} /><i aria-hidden="true" /></label><label className="settings-toggle"><span><strong>Return period</strong><small>Show alerts when a saved return window is close to ending.</small></span><input type="checkbox" checked={activePreferences.returnPeriod} onChange={event => changePreference("returnPeriod", event.target.checked)} /><i aria-hidden="true" /></label><label className="settings-toggle"><span><strong>General product & document reminders</strong><small>Show missing receipt and coverage-details review reminders.</small></span><input type="checkbox" checked={activePreferences.generalReminders} onChange={event => changePreference("generalReminders", event.target.checked)} /><i aria-hidden="true" /></label></fieldset>
        {updatePreferences.isError ? <p className="form-error">{updatePreferences.error.message || "We couldn't save those preferences. Please try again."}</p> : null}
        {updatePreferences.isSuccess && !preferencesDirty ? <p className="settings-success">Notification preferences saved.</p> : null}
        <div className="form-actions"><button type="button" className="button button--primary" onClick={savePreferences} disabled={!preferencesDirty || updatePreferences.isPending}>{updatePreferences.isPending ? <Loader2 className="spin" size={16} /> : <BellRing size={16} />} Save notification preferences</button></div>
      </section>

      <section className="panel settings-panel settings-panel--soft" aria-labelledby="settings-data-title">
        <div className="settings-panel__heading"><span className="settings-panel__icon settings-panel__icon--sand"><FileText size={18} /></span><div><span className="eyebrow">Data & documents</span><h2 id="settings-data-title">Your paper trail, in one place.</h2><p>Open Documents to view, download, or remove stored files. Removing a document always asks you to confirm first.</p></div></div>
        <Link href="/documents" className="button button--quiet">Manage documents <ArrowUpRight size={15} /></Link>
      </section>

      <section className="panel settings-panel" aria-labelledby="settings-privacy-title">
        <div className="settings-panel__heading"><span className="settings-panel__icon settings-panel__icon--sage"><LockKeyhole size={18} /></span><div><span className="eyebrow">Privacy</span><h2 id="settings-privacy-title">A personal archive.</h2><p>Your StashVault records are kept separate by your signed-in account. This page only changes your display name and in-app reminder choices; it does not expose sign-in credentials.</p></div></div>
        <p className="quiet-panel-copy">Privacy and Terms pages are not available in this app yet, so StashVault does not present placeholder links for them.</p>
      </section>

      <section className="panel settings-panel" aria-labelledby="settings-account-title">
        <div className="settings-panel__heading"><span className="settings-panel__icon settings-panel__icon--blush"><LogOut size={18} /></span><div><span className="eyebrow">Account</span><h2 id="settings-account-title">Sign out when you are finished.</h2><p>Signing out clears this StashVault session on this device. Your saved records stay in your account.</p></div></div>
        {signOutError ? <p className="form-error">{signOutError}</p> : null}
        <button type="button" className="button button--dark" onClick={() => void signOut()}><LogOut size={16} /> Sign out</button>
        <div className="settings-unavailable"><strong>Account deletion is unavailable here.</strong><p>StashVault cannot safely remove the external sign-in identity that protects this account, so no destructive account-deletion control is shown.</p></div>
      </section>

      <section className="panel settings-panel settings-panel--soft settings-app-info" aria-labelledby="settings-app-info-title"><span className="eyebrow">App information</span><h2 id="settings-app-info-title">StashVault</h2><p>Version 1.0.0</p><p className="quiet-panel-copy">Appearance follows the current StashVault design. There are no themes to configure in this release.</p></section>
    </div>
  </div>;
}

type ConsiderationFormValues = {
  name: string;
  brand: string;
  model: string;
  category: string;
  estimatedPrice: string;
  currency: string;
  plannedOwnershipMonths: string;
  expectedWarrantyMonths: string;
  repairabilityNotes: string;
  expectedResaleValue: string;
  expectedResaleValueAtMonths: string;
  notes: string;
};

type ConsiderationRecord = {
  id: number;
  name: string;
  brand?: string | null;
  model?: string | null;
  category: string;
  estimatedPrice?: number | null;
  currency: string;
  plannedOwnershipMonths?: number | null;
  expectedWarrantyMonths?: number | null;
  repairabilityNotes?: string | null;
  expectedResaleValue?: number | null;
  expectedResaleValueAtMonths?: number | null;
  notes?: string | null;
  monthlyCost: number | null;
  ownershipEstimateMissing: ("estimatedPrice" | "plannedOwnershipMonths")[];
  resaleEstimate: { value: number; months: number } | null;
};

const blankConsiderationForm = (): ConsiderationFormValues => ({ name: "", brand: "", model: "", category: "Electronics", estimatedPrice: "", currency: "INR", plannedOwnershipMonths: "", expectedWarrantyMonths: "", repairabilityNotes: "", expectedResaleValue: "", expectedResaleValueAtMonths: "", notes: "" });

function considerationFormValues(product?: ConsiderationRecord): ConsiderationFormValues {
  if (!product) return blankConsiderationForm();
  return {
    name: product.name,
    brand: product.brand ?? "",
    model: product.model ?? "",
    category: product.category,
    estimatedPrice: product.estimatedPrice === null || product.estimatedPrice === undefined ? "" : String(product.estimatedPrice),
    currency: product.currency || "INR",
    plannedOwnershipMonths: product.plannedOwnershipMonths ? String(product.plannedOwnershipMonths) : "",
    expectedWarrantyMonths: product.expectedWarrantyMonths === null || product.expectedWarrantyMonths === undefined ? "" : String(product.expectedWarrantyMonths),
    repairabilityNotes: product.repairabilityNotes ?? "",
    expectedResaleValue: product.expectedResaleValue === null || product.expectedResaleValue === undefined ? "" : String(product.expectedResaleValue),
    expectedResaleValueAtMonths: product.expectedResaleValueAtMonths ? String(product.expectedResaleValueAtMonths) : "",
    notes: product.notes ?? "",
  };
}

function formatAmount(amount?: number | null, currency = "INR") {
  if (amount === null || amount === undefined) return "Not provided";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export function ConnectedBeforeYouBuyPage() {
  const [, setLocation] = useLocation();
  const context = trpc.beforeYouBuy.context.useQuery();
  const ownedProducts = trpc.product.list.useQuery();
  const create = trpc.beforeYouBuy.create.useMutation({ onSuccess: () => void context.refetch() });
  const update = trpc.beforeYouBuy.update.useMutation({ onSuccess: () => void context.refetch() });
  const remove = trpc.beforeYouBuy.delete.useMutation({ onSuccess: () => void context.refetch() });
  const moveToStash = trpc.beforeYouBuy.moveToStash.useMutation({ onSuccess: product => { void context.refetch(); setLocation(`/product/${product.id}`); } });
  const [editing, setEditing] = useState<ConsiderationRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ConsiderationFormValues>(blankConsiderationForm);
  const [submitted, setSubmitted] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const comparison = trpc.beforeYouBuy.compare.useQuery({ productIds: [selectedIds[0] ?? -1, selectedIds[1] ?? -2] }, { enabled: selectedIds.length === 2 });
  const items = (context.data?.considerations ?? []) as ConsiderationRecord[];
  const repairCandidate = sortProductsForRepair(ownedProducts.data ?? [])[0];
  const error = create.error?.message || update.error?.message || remove.error?.message || moveToStash.error?.message;

  const openCreate = () => { setEditing(null); setForm(blankConsiderationForm()); setSubmitted(false); setFormOpen(true); };
  const openEdit = (product: ConsiderationRecord) => { setEditing(product); setForm(considerationFormValues(product)); setSubmitted(false); setFormOpen(true); };
  const change = (field: keyof ConsiderationFormValues, value: string) => setForm(current => ({ ...current, [field]: value }));
  const formPayload = () => ({
    name: form.name.trim(), brand: form.brand.trim() || null, model: form.model.trim() || null, category: form.category.trim() || "Other",
    estimatedPrice: form.estimatedPrice ? Number(form.estimatedPrice) : null, currency: form.currency,
    plannedOwnershipMonths: form.plannedOwnershipMonths ? Number(form.plannedOwnershipMonths) : null,
    expectedWarrantyMonths: form.expectedWarrantyMonths ? Number(form.expectedWarrantyMonths) : null,
    repairabilityNotes: form.repairabilityNotes.trim() || null,
    expectedResaleValue: form.expectedResaleValue ? Number(form.expectedResaleValue) : null,
    expectedResaleValueAtMonths: form.expectedResaleValueAtMonths ? Number(form.expectedResaleValueAtMonths) : null,
    notes: form.notes.trim() || null,
  });
  const save = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!form.name.trim()) return;
    const payload = formPayload();
    if (editing) update.mutate({ id: editing.id, ...payload }, { onSuccess: () => { setFormOpen(false); setEditing(null); } });
    else create.mutate(payload, { onSuccess: () => setFormOpen(false) });
  };
  const toggleCompare = (id: number) => setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : current.length < 2 ? [...current, id] : [current[1], id]);
  const askComparison = () => {
    const names = items.filter(item => selectedIds.includes(item.id)).map(item => item.name);
    if (names.length === 2) setLocation(`/ask-stashly?question=${encodeURIComponent(`Compare ${names[0]} and ${names[1]} using the saved costs, ownership estimates, warranty details, repairability notes, and resale estimates. Tell me what information is still missing.`)}`);
  };

  return <div className="page before-buy-page">
    <div className="page-topbar"><div><span className="eyebrow">Decide with your records</span><h1>Before You Buy<span className="heading-period">.</span></h1></div><button type="button" className="button button--primary" onClick={openCreate}><Plus size={17} /> Add item</button></div>
    <section className="panel panel--soft before-buy-intro"><div><span className="eyebrow">A calm place to compare</span><h2>Keep the next purchase in view.</h2><p>Save only the details you know, compare two options side by side, and see what still needs checking before you buy.</p></div></section>
    {context.isLoading ? <SoftLoading label="Opening your saved considerations…" /> : context.isError ? <SoftError retry={() => context.refetch()} copy="We couldn't load your saved considerations right now." /> : <>
      {context.data?.ownedCategoryCounts.length ? <section className="before-buy-owned-context"><span className="eyebrow">Already in your Stash</span><p>{context.data.ownedCategoryCounts.map(item => `${item.category} (${item.count})`).join(" · ")}</p></section> : <section className="before-buy-owned-context"><span className="eyebrow">Your current Stash</span><p>No saved product categories yet. Add a product when you are ready.</p></section>}
      {formOpen && <section className="panel before-buy-form-panel"><div className="before-buy-form-panel__heading"><div><span className="eyebrow">{editing ? "Edit consideration" : "Add consideration"}</span><h2>{editing ? "Update the details you know." : "Start with what you know."}</h2></div><button type="button" className="button button--quiet button--small" onClick={() => setFormOpen(false)}>Close</button></div><form className="product-form before-buy-form" onSubmit={save} noValidate><div className="product-form__grid"><label className={submitted && !form.name.trim() ? "auth-field auth-field--error" : "auth-field"}>Product name<input value={form.name} onChange={event => change("name", event.target.value)} placeholder="e.g. Noise-cancelling headphones" />{submitted && !form.name.trim() ? <small>Give this item a name.</small> : null}</label><label className="auth-field">Category<select value={form.category} onChange={event => change("category", event.target.value)}><option>Electronics</option><option>Home</option><option>Wearables</option><option>Photography</option><option>Gaming</option><option>Other</option></select></label><label className="auth-field">Brand<input value={form.brand} onChange={event => change("brand", event.target.value)} placeholder="Optional" /></label><label className="auth-field">Model<input value={form.model} onChange={event => change("model", event.target.value)} placeholder="Optional" /></label><label className="auth-field">Estimated cost<input value={form.estimatedPrice} onChange={event => change("estimatedPrice", event.target.value)} type="number" min="0" step="0.01" placeholder="Optional" /></label><label className="auth-field">Currency<select value={form.currency} onChange={event => change("currency", event.target.value)}><option value="INR">INR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option></select></label><label className="auth-field">Planned ownership (months)<input value={form.plannedOwnershipMonths} onChange={event => change("plannedOwnershipMonths", event.target.value)} type="number" min="1" max="600" placeholder="Optional" /></label><label className="auth-field">Expected warranty (months)<input value={form.expectedWarrantyMonths} onChange={event => change("expectedWarrantyMonths", event.target.value)} type="number" min="0" max="240" placeholder="Optional" /></label><label className="auth-field">Expected resale value<input value={form.expectedResaleValue} onChange={event => change("expectedResaleValue", event.target.value)} type="number" min="0" step="0.01" placeholder="Optional" /></label><label className="auth-field">Resale timing (months)<input value={form.expectedResaleValueAtMonths} onChange={event => change("expectedResaleValueAtMonths", event.target.value)} type="number" min="1" max="600" placeholder="Optional" /></label><label className="auth-field product-form__full">Repairability notes<textarea value={form.repairabilityNotes} onChange={event => change("repairabilityNotes", event.target.value)} placeholder="Only add notes you have verified, such as an available spare-parts policy." maxLength={4000} /></label><label className="auth-field product-form__full">Notes<textarea value={form.notes} onChange={event => change("notes", event.target.value)} placeholder="What you still want to check before buying." maxLength={4000} /></label></div>{error ? <p className="form-error">{error}</p> : null}<div className="form-actions"><button className="button button--primary" type="submit" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}{editing ? "Save changes" : "Save for comparison"}</button><button className="button button--quiet" type="button" onClick={() => setFormOpen(false)}>Cancel</button></div></form></section>}
      {items.length ? <section className="panel before-buy-list-panel"><SectionHeading eyebrow="Saved considerations" title="Compare what matters." action={<span className="before-buy-selection">{selectedIds.length}/2 selected</span>} /><div className="before-buy-list">{items.map(item => <article className={`before-buy-card${selectedIds.includes(item.id) ? " before-buy-card--selected" : ""}`} key={item.id}><div className="before-buy-card__heading"><div><span className="eyebrow">{item.category}</span><h3>{item.name}</h3><p>{[item.brand, item.model].filter(Boolean).join(" · ") || "Brand and model not provided"}</p></div><label className="before-buy-compare-toggle"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleCompare(item.id)} />Compare</label></div><dl className="before-buy-card__facts"><div><dt>Estimated cost</dt><dd>{formatAmount(item.estimatedPrice, item.currency)}</dd></div><div><dt>Real cost over time</dt><dd>{item.monthlyCost === null ? "Add cost + planned months" : `${formatAmount(item.monthlyCost, item.currency)} / month`}</dd></div><div><dt>Expected warranty</dt><dd>{item.expectedWarrantyMonths === null || item.expectedWarrantyMonths === undefined ? "Not provided" : `${item.expectedWarrantyMonths} months`}</dd></div><div><dt>Resale estimate</dt><dd>{item.resaleEstimate ? `${formatAmount(item.resaleEstimate.value, item.currency)} at ${item.resaleEstimate.months} months` : "Not provided"}</dd></div></dl><div className="before-buy-card__notes"><span className="eyebrow">Repairability</span><p>{item.repairabilityNotes || "Not provided — check repairability before replacing an existing item."}</p></div><div className="before-buy-card__missing"><strong>Still useful to check:</strong> <span>{[...item.ownershipEstimateMissing.map(field => field === "estimatedPrice" ? "estimated cost" : "planned ownership period"), !item.expectedWarrantyMonths ? "expected warranty period" : null, !item.repairabilityNotes ? "repairability notes" : null, !item.resaleEstimate ? "resale estimate" : null].filter(Boolean).join(" · ") || "No core comparison fields are missing."}</span></div><div className="before-buy-card__actions"><button type="button" className="button button--quiet button--small" onClick={() => openEdit(item)}>Edit</button><button type="button" className="button button--quiet button--small" disabled={moveToStash.isPending} onClick={() => moveToStash.mutate({ id: item.id })}>Move to Stash</button><button type="button" className="text-link text-link--danger" disabled={remove.isPending} onClick={() => remove.mutate({ id: item.id })}>Delete</button></div></article>)}</div></section> : !formOpen ? <section className="panel stashly-empty-panel"><EmptyState title="Nothing under consideration yet." copy="Add a product you are thinking about to compare the details you know before buying." cta="Add an item" /><button type="button" className="button button--primary" onClick={openCreate}><Plus size={16} /> Add item</button></section> : null}
      {selectedIds.length === 2 ? <section className="panel before-buy-comparison"><SectionHeading eyebrow="Side-by-side comparison" title="What your saved details show." action={<button type="button" className="button button--quiet button--small" onClick={() => setSelectedIds([])}>Clear comparison</button>} />{comparison.isLoading ? <SoftLoading label="Preparing this comparison…" /> : comparison.isError || !comparison.data ? <SoftError retry={() => comparison.refetch()} copy="We couldn't compare those saved items right now." /> : <><div className="before-buy-comparison__grid">{comparison.data.products.map(product => <article key={product.id}><span className="eyebrow">Saved consideration</span><h3>{product.name}</h3><dl><div><dt>Cost</dt><dd>{formatAmount(product.estimatedPrice, product.currency)}</dd></div><div><dt>Monthly estimate</dt><dd>{product.monthlyCost === null ? "Not available" : `${formatAmount(product.monthlyCost, product.currency)} / month`}</dd></div><div><dt>Warranty</dt><dd>{product.expectedWarrantyMonths ? `${product.expectedWarrantyMonths} months` : "Not provided"}</dd></div><div><dt>Resale</dt><dd>{product.resaleEstimate ? `${formatAmount(product.resaleEstimate.value, product.currency)} at ${product.resaleEstimate.months} months` : "Not provided"}</dd></div><div><dt>Repairability</dt><dd>{product.repairabilityNotes || "Not provided"}</dd></div></dl>{product.missing.length ? <p className="before-buy-comparison__missing">Still to check: {product.missing.join(" · ")}</p> : null}</article>)}</div><div className="before-buy-comparison__footer"><p>These are simple calculations from the values you saved. They are not repair prices, warranty promises, or market predictions.</p><button type="button" className="button button--dark" onClick={askComparison}><Sparkles size={16} /> Ask StashVault</button></div></>}</section> : null}
      <section className="panel before-buy-repair-note"><div><span className="eyebrow">Repair first</span><h2>Pause before replacing.</h2><p>{repairCandidate ? `${repairCandidate.name}: ${repairRecommendation(repairCandidate)} Repairing instead of replacing can help extend the life of your product.` : "Before buying a replacement, check the repair and warranty details of the product you already own. Repairing instead of replacing can help extend the life of a product."}</p></div><Link href="/repair" className="button button--quiet button--small">Review repair options <ArrowUpRight size={15} /></Link></section>
    </>}
  </div>;
}

type StashConversationSource = { productId: number; productName: string; hasReceiptOrInvoice: boolean; hasDocuments: boolean };
type StashConversationMessage = { id: string; role: "user" | "assistant"; content: string; sources?: StashConversationSource[] };

const assistantWelcome: StashConversationMessage = {
  id: "welcome",
  role: "assistant",
  content: "Hi, I’m your StashVault assistant. Ask me anything about your purchases, receipts, warranties, returns, or products.",
};

const assistantPrompts = [
  "Which of my products are still under warranty?",
  "Which warranties expire soon?",
  "Show me my recent purchases.",
  "Where is my receipt for this product?",
];

export function ConnectedAskStashVaultPage() {
  const [location] = useLocation();
  const ask = trpc.stashAssistant.ask.useMutation();
  const readPrefilledQuestion = () => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("question")?.slice(0, 2000) ?? "";
  const [question, setQuestion] = useState(readPrefilledQuestion);
  const [messages, setMessages] = useState<StashConversationMessage[]>([assistantWelcome]);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState("StashVault couldn't answer right now. Your conversation is still here.");
  const messageId = useRef(0);
  const conversationHistory = messages.filter(message => message.id !== "welcome").map(message => ({ role: message.role, content: message.content }));
  useEffect(() => { const prefilled = readPrefilledQuestion(); if (prefilled) setQuestion(prefilled); }, [location]);

  const sendQuestion = async (nextQuestion: string, includeUserMessage = true) => {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion || ask.isPending) return;
    const history = assistantHistoryForAttempt(conversationHistory, !includeUserMessage);
    if (includeUserMessage) {
      messageId.current += 1;
      setMessages(current => [...current, { id: `user-${messageId.current}`, role: "user", content: cleanQuestion }]);
      setQuestion("");
    }
    setFailedQuestion(null);
    setFailureMessage("StashVault couldn't answer right now. Your conversation is still here.");
    try {
      const result = await ask.mutateAsync({ question: cleanQuestion, history });
      messageId.current += 1;
      setMessages(current => [...current, { id: `assistant-${messageId.current}`, role: "assistant", content: result.answer, sources: result.sources }]);
    } catch (error) {
      setFailedQuestion(cleanQuestion);
      setFailureMessage(safeAssistantFailureMessage(error));
    }
  };

  const startNewConversation = () => {
    setMessages([assistantWelcome]);
    setQuestion("");
    setFailedQuestion(null);
    setFailureMessage("StashVault couldn't answer right now. Your conversation is still here.");
  };

  return <div className="page assistant-page">
    <div className="page-topbar"><div><span className="eyebrow">Your private product guide</span><h1>Ask StashVault<span className="heading-period">.</span></h1></div><button type="button" className="button button--quiet button--small" onClick={startNewConversation}><Sparkles size={15} /> New conversation</button></div>
    <section className="panel panel--soft assistant-intro"><div><span className="eyebrow">Ask with confidence</span><h2>Your saved details, made useful.</h2><p>Answers use the products and document records in your StashVault. General guidance is clearly kept separate.</p></div><Link href="/upload" className="button button--quiet button--small"><Upload size={15} /> Upload receipt</Link></section>
    <section className="panel assistant-chat" aria-label="Ask StashVault conversation">
      <div className="assistant-chat__messages" aria-live="polite">
        {messages.map(message => <article className={`assistant-chat__message assistant-chat__message--${message.role}`} key={message.id}><span className="assistant-chat__speaker">{message.role === "assistant" ? "StashVault" : "You"}</span><p>{message.content}</p>{message.role === "assistant" && message.sources?.length ? <div className="assistant-chat__sources">{message.sources.map(source => <Link className="assistant-chat__source" href={`/product/${source.productId}`} key={source.productId}><FileText size={14} /><span>{source.hasReceiptOrInvoice ? "Receipt or invoice saved" : source.hasDocuments ? "Saved documents" : "View product"} · {source.productName}</span><ArrowUpRight size={13} /></Link>)}</div> : null}</article>)}
        {ask.isPending && <article className="assistant-chat__message assistant-chat__message--assistant assistant-chat__message--loading"><Loader2 size={16} className="spin" /><span>Looking through your saved details…</span></article>}
        {failedQuestion ? <article className="assistant-chat__error"><CircleAlert size={17} /><div><strong>StashVault couldn’t answer right now.</strong><p>{failureMessage}</p></div><button type="button" className="button button--dark button--small" onClick={() => void sendQuestion(failedQuestion, false)}>Try again</button></article> : null}
      </div>
      {messages.length === 1 && !ask.isPending ? <div className="assistant-chat__suggestions"><span className="eyebrow">Try asking</span><div>{assistantPrompts.map(prompt => <button type="button" className="assistant-suggestion" key={prompt} onClick={() => void sendQuestion(prompt)}>{prompt}<ArrowUpRight size={14} /></button>)}</div></div> : null}
      <form className="assistant-chat__composer" onSubmit={event => { event.preventDefault(); void sendQuestion(question); }}><label className="sr-only" htmlFor="stash-assistant-question">Ask StashVault a question</label><textarea id="stash-assistant-question" value={question} onChange={event => setQuestion(event.target.value)} placeholder="Ask about a purchase, receipt, warranty, return, or product…" maxLength={2000} rows={2} disabled={ask.isPending} /><button type="submit" className="button button--primary" disabled={!question.trim() || ask.isPending}>{ask.isPending ? <Loader2 size={16} className="spin" /> : <ArrowUpRight size={16} />} Ask</button></form>
    </section>
  </div>;
}

type ProductFormValues = { name: string; brand: string; model: string; category: string; purchasePrice: string; purchasedAt: string; warrantyMonths: string; warrantyStartsAt: string; warrantyExpiresAt: string; returnPeriodDays: string; returnStartsAt: string; returnExpiresAt: string; purchasedFrom: string; serialNumber: string; notes: string; };

function formValues(product?: ProductRecord): ProductFormValues {
  return { name: product?.name ?? "", brand: product?.brand ?? "", model: product?.model ?? "", category: product?.category ?? "Electronics", purchasePrice: product?.purchasePrice === null || product?.purchasePrice === undefined ? "" : String(product.purchasePrice), purchasedAt: toDateInput(product?.purchasedAt), warrantyMonths: product?.warrantyMonths === null || product?.warrantyMonths === undefined ? "" : String(product.warrantyMonths), warrantyStartsAt: toDateInput(product?.warrantyStartsAt), warrantyExpiresAt: toDateInput(product?.warrantyExpiresAt), returnPeriodDays: product?.returnPeriodDays === null || product?.returnPeriodDays === undefined ? "" : String(product.returnPeriodDays), returnStartsAt: toDateInput(product?.returnStartsAt), returnExpiresAt: toDateInput(product?.returnExpiresAt), purchasedFrom: product?.purchasedFrom ?? "", serialNumber: product?.serialNumber ?? "", notes: product?.notes ?? "" };
}

export function ProductForm({ product, onComplete }: { product?: ProductRecord; onComplete: (productId: number) => void }) {
  const [values, setValues] = useState<ProductFormValues>(() => formValues(product));
  const [submitted, setSubmitted] = useState(false);
  const create = trpc.product.create.useMutation({ onSuccess: saved => onComplete(saved.id) });
  const update = trpc.product.update.useMutation({ onSuccess: saved => onComplete(saved.id) });
  const pending = create.isPending || update.isPending;
  const message = create.error?.message || update.error?.message;
  const change = (field: keyof ProductFormValues, value: string) => setValues(current => ({ ...current, [field]: value }));
  const requiredError = submitted && !values.name.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!values.name.trim()) return;
    const payload = { name: values.name.trim(), brand: values.brand.trim() || null, model: values.model.trim() || null, category: values.category.trim() || "Other", purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : null, purchasedAt: values.purchasedAt || null, warrantyMonths: values.warrantyMonths ? Number(values.warrantyMonths) : null, warrantyStartsAt: values.warrantyStartsAt || null, warrantyExpiresAt: values.warrantyExpiresAt || null, returnPeriodDays: values.returnPeriodDays ? Number(values.returnPeriodDays) : null, returnStartsAt: values.returnStartsAt || null, returnExpiresAt: values.returnExpiresAt || null, purchasedFrom: values.purchasedFrom.trim() || null, serialNumber: values.serialNumber.trim() || null, notes: values.notes.trim() || null };
    if (product) update.mutate({ id: product.id, ...payload }); else create.mutate(payload);
  };
  return <form className="product-form" onSubmit={submit} noValidate><div className="product-form__grid"><label className={requiredError ? "auth-field auth-field--error" : "auth-field"}>Product name<input value={values.name} onChange={event => change("name", event.target.value)} placeholder="e.g. MacBook Air" />{requiredError && <small>Give this item a name so you can find it later.</small>}</label><label className="auth-field">Category<select value={values.category} onChange={event => change("category", event.target.value)}><option>Electronics</option><option>Home</option><option>Wearables</option><option>Photography</option><option>Gaming</option><option>Other</option></select></label><label className="auth-field">Brand<input value={values.brand} onChange={event => change("brand", event.target.value)} placeholder="Apple, Sony, Samsung…" /></label><label className="auth-field">Model<input value={values.model} onChange={event => change("model", event.target.value)} placeholder="Optional" /></label><label className="auth-field">Purchase date<input value={values.purchasedAt} onChange={event => change("purchasedAt", event.target.value)} type="date" /></label><label className="auth-field">Purchase price<input value={values.purchasePrice} onChange={event => change("purchasePrice", event.target.value)} type="number" min="0" step="0.01" placeholder="0.00" /></label><label className="auth-field">Warranty duration (months)<input value={values.warrantyMonths} onChange={event => change("warrantyMonths", event.target.value)} type="number" min="0" max="240" placeholder="Optional" /></label><label className="auth-field">Warranty starts<input value={values.warrantyStartsAt} onChange={event => change("warrantyStartsAt", event.target.value)} type="date" /></label><label className="auth-field">Warranty expires<input value={values.warrantyExpiresAt} onChange={event => change("warrantyExpiresAt", event.target.value)} type="date" /></label><label className="auth-field">Return period (days)<input value={values.returnPeriodDays} onChange={event => change("returnPeriodDays", event.target.value)} type="number" min="0" max="365" placeholder="Optional" /></label><label className="auth-field">Return starts<input value={values.returnStartsAt} onChange={event => change("returnStartsAt", event.target.value)} type="date" /></label><label className="auth-field">Return expires<input value={values.returnExpiresAt} onChange={event => change("returnExpiresAt", event.target.value)} type="date" /></label><label className="auth-field">Bought from<input value={values.purchasedFrom} onChange={event => change("purchasedFrom", event.target.value)} placeholder="Store or seller" /></label><label className="auth-field">Serial number<input value={values.serialNumber} onChange={event => change("serialNumber", event.target.value)} placeholder="Optional" /></label><label className="auth-field product-form__wide">Notes<textarea value={values.notes} onChange={event => change("notes", event.target.value)} placeholder="Anything useful to remember?" rows={3} /></label></div>{message && <p className="form-error">{message}</p>}<button className="button button--dark" disabled={pending} type="submit">{pending ? <Loader2 size={16} className="spin" /> : <Package size={16} />}{product ? "Save changes" : "Add to your stash"}</button></form>;
}

export function ManualProductPage() {
  const [, setLocation] = useLocation();
  const [saved, setSaved] = useState(false);
  return <div className="page"><div className="back-link"><Link href="/add"><ChevronRight size={15} className="back-link__icon" /> Back to add</Link></div><section className="manual-product-layout"><div><span className="eyebrow">A clean record</span><h1>Keep the useful<br /><em>details close.</em></h1><p className="lede">Start with what you know. Stashly will hold the dates, coverage, and small details together.</p></div><div className="panel manual-product-panel">{saved ? <div className="stashly-success"><Sparkles size={22} /><span className="eyebrow">Saved to your archive</span><h2>Added to your stash.</h2><p>That’s one less thing to remember.</p></div> : <><SectionHeading eyebrow="Manual entry" title="Add an item" /><ProductForm onComplete={id => { setSaved(true); window.setTimeout(() => setLocation(`/product/${id}`), 700); }} /></>}</div></section></div>;
}

export function ConnectedUploadPage() {
  const [, setLocation] = useLocation();
  const products = trpc.product.list.useQuery();
  const prepareUpload = trpc.document.prepareUpload.useMutation();
  const upload = trpc.document.upload.useMutation();
  const [productId, setProductId] = useState("");
  const [documentType, setDocumentType] = useState<UploadDocumentType>("receipt");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const chooseFile = (candidate?: File) => {
    setFileError("");
    setSaved(null);
    if (!candidate) return;
    if (!(["application/pdf", "image/jpeg", "image/png", "image/webp"] as string[]).includes(candidate.type)) { setFile(null); setFileError("Please choose a PDF, JPG, PNG, or WEBP image."); return; }
    if (candidate.size > 10 * 1024 * 1024) { setFile(null); setFileError("This file is too large. Please choose one under 10 MB."); return; }
    setFile(candidate);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFileError("");
    setSaved(null);
    if (!productId) { setFileError("Choose the item this document belongs to."); return; }
    if (!file) { setFileError("Choose a receipt, invoice, warranty, or other document first."); return; }
    try {
      await prepareUpload.mutateAsync({ productId: Number(productId), fileName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", size: file.size });
      setPreparing(true);
      const base64 = await readFileAsBase64(file);
      setPreparing(false);
      await upload.mutateAsync({ productId: Number(productId), documentType, fileName: file.name, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", base64 });
      setSaved(Number(productId));
    } catch (error) { setPreparing(false); setFileError(error instanceof Error ? error.message : "We couldn't read that file. Please try again."); }
  };
  const busy = preparing || prepareUpload.isPending || upload.isPending;
  return <div className="page"><div className="back-link"><Link href="/add"><ChevronRight size={15} className="back-link__icon" /> Back to add</Link></div><div className="upload-layout"><section><span className="eyebrow">Private paper trail</span><h1>One small upload.<br /><em>A lot less to remember.</em></h1><p className="lede">Keep a receipt, invoice, warranty, or useful proof close to the item it belongs to. Your document stays private to your archive.</p><div className="upload-trust"><ShieldCheck size={16} /><span>PDF, JPG, PNG, or WEBP · up to 10 MB</span></div></section><form className="upload-dropzone upload-dropzone--connected" onSubmit={submit} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}><div className="upload-dropzone__icon"><Upload size={25} /></div><span className="eyebrow">Step 1 · choose a file</span><h2>{file ? file.name : "Choose a document to begin"}</h2><p>{file ? `${Math.ceil(file.size / 1024)} KB · ${file.type.replace("image/", "").toUpperCase()}` : "Drop it here or choose from your device"}</p><input id="stashly-document-file" className="visually-hidden" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp" onChange={event => chooseFile(event.currentTarget.files?.[0])} /><label className="button button--dark" htmlFor="stashly-document-file">{file ? "Choose another file" : "Choose from device"}<ArrowUpRight size={16} /></label><div className="upload-fields"><label className="auth-field">Item<select value={productId} onChange={event => setProductId(event.target.value)} disabled={products.isLoading || busy}><option value="">{products.isLoading ? "Loading your stash…" : "Choose an item"}</option>{(products.data ?? []).map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="auth-field">Document type<select value={documentType} onChange={event => setDocumentType(event.target.value as UploadDocumentType)} disabled={busy}><option value="receipt">Receipt</option><option value="invoice">Invoice</option><option value="warranty">Warranty</option><option value="service_record">Service record</option><option value="other">Other</option></select></label></div>{busy && <div className="upload-progress"><span><Loader2 size={14} className="spin" /> {prepareUpload.isPending ? "Checking this attachment…" : preparing ? "Preparing your document…" : "Saving it to your archive…"}</span><i /></div>}{fileError && <p className="form-error">{fileError}</p>}{upload.isError && <p className="form-error">{upload.error.message || "We couldn't save that document. Please try again."}</p>}{saved && <div className="stashly-success stashly-success--compact"><ShieldCheck size={18} /><span>Document saved to your stash.</span><button type="button" className="text-link" onClick={() => setLocation(`/product/${saved}`)}>View product <ArrowUpRight size={14} /></button></div>}<button className="button button--primary upload-submit" disabled={!file || !productId || busy} type="submit">{busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Save to Stashly</button><span className="upload-dropzone__note"><ShieldCheck size={14} /> OCR and AI extraction are not enabled yet.</span></form></div></div>;
}

export function ConnectedDocumentsPage() {
  const documents = trpc.document.list.useQuery();
  const products = trpc.product.list.useQuery();
  const productNames = new Map((products.data ?? []).map(product => [product.id, product.name]));
  return <div className="page"><div className="page-topbar"><div><span className="eyebrow">Your paper trail</span><h1>Documents<span className="heading-period">.</span></h1></div><Link href="/upload" className="button button--primary"><Upload size={17} /> Upload document</Link></div><section className="panel documents-panel"><SectionHeading eyebrow="Saved with care" title="Nothing lost in the drawer." />{documents.isLoading ? <SoftLoading label="Opening your paper trail…" /> : documents.isError ? <SoftError retry={() => documents.refetch()} copy="We couldn't open your documents right now." /> : <DocumentList documents={documents.data as DocumentRecord[]} onChanged={() => documents.refetch()} productNames={productNames} />}</section></div>;
}

export function ConnectedProductDetails({ productId }: { productId: number }) {
  const [, setLocation] = useLocation();
  const query = trpc.product.get.useQuery({ id: productId });
  const deleteMutation = trpc.product.delete.useMutation({ onSuccess: () => setLocation("/stash") });
  const [editing, setEditing] = useState(false);
  if (query.isLoading) return <SoftLoading label="Opening this record…" />;
  if (query.isError || !query.data) return <SoftError retry={() => query.refetch()} copy={query.error?.data?.code === "NOT_FOUND" ? "We couldn't find this product." : undefined} />;
  const { product, documents, events } = query.data;
  const status = statusForCard(product);
  const returnBadge = returnBadgeForCard(product);
  const remove = () => { if (window.confirm("Remove this product from your stash? This will also remove its saved ownership history.")) deleteMutation.mutate({ id: product.id }); };
  const hasInvoice = documents.some(document => document.documentType === "invoice" || document.documentType === "receipt");
  return <div className="page">
    <div className="back-link"><Link href="/stash"><ChevronRight size={15} className="back-link__icon" /> Back to My Stash</Link></div>
    <div className="detail-layout">
      <div className="detail-primary">
        <section className="product-detail-card">
          <div className="product-detail-card__art"><span className="archive-tab archive-tab--sage">{product.category}</span><Package size={58} strokeWidth={1.2} /></div>
          <div className="product-detail-card__copy">
            <span className="eyebrow">Saved {formatDate(product.purchasedAt)}</span>
            <h1>{product.name}<span className="heading-period">.</span></h1>
            <p className="product-subtitle">{[product.brand, product.model].filter(Boolean).join(" · ") || "Product details in your archive"}</p>
            <div className="detail-status"><StatusBadge status={status.status}>{status.text}</StatusBadge><StatusBadge status={returnBadge.status}>{returnBadge.text}</StatusBadge></div>
            <div className="detail-actions"><button className="button button--quiet" onClick={() => setEditing(current => !current)}>{editing ? "Close editor" : "Edit details"}</button><Link href="/upload" className="button button--quiet"><Upload size={15} /> Upload document</Link><button className="button button--quiet button--danger" disabled={deleteMutation.isPending} onClick={remove}><Trash2 size={15} /> Remove</button></div>
          </div>
        </section>
        <div className="detail-facts-grid">
          <section className="panel detail-facts"><SectionHeading eyebrow="Purchase" title="Ownership details" /><dl><div><dt>Bought from</dt><dd>{product.purchasedFrom || "Review needed"}</dd></div><div><dt>Purchase date</dt><dd>{formatDate(product.purchasedAt)}</dd></div><div><dt>Price</dt><dd>{product.purchasePrice === null ? "Review needed" : `${product.currency} ${product.purchasePrice.toLocaleString()}`}</dd></div><div><dt>Invoice number</dt><dd>{product.invoiceNumber || "Review needed"}</dd></div><div><dt>Serial number</dt><dd>{product.serialNumber || "Review needed"}</dd></div></dl></section>
          <section className="panel detail-facts"><SectionHeading eyebrow="Warranty" title="Coverage" /><div className="detail-facts__badge"><StatusBadge status={status.status}>{status.text}</StatusBadge></div><dl><div><dt>Starts</dt><dd>{formatDate(product.warrantyStartDate)}</dd></div><div><dt>Length</dt><dd>{product.warrantyMonths ? `${product.warrantyMonths} months` : "Review needed"}</dd></div><div><dt>Expires</dt><dd>{formatDate(product.warrantyExpiresAt)}</dd></div></dl></section>
          <section className="panel detail-facts"><SectionHeading eyebrow="Returns" title="Return window" /><div className="detail-facts__badge"><StatusBadge status={returnBadge.status}>{returnBadge.text}</StatusBadge></div><dl><div><dt>Starts</dt><dd>{formatDate(product.returnStartDate)}</dd></div><div><dt>Length</dt><dd>{product.returnPeriodDays ? `${product.returnPeriodDays} days` : "Review needed"}</dd></div><div><dt>Ends</dt><dd>{formatDate(product.returnExpiresAt)}</dd></div></dl></section>
        </div>
        <ClaimAssistantPanel productId={product.id} />
      </div>
      <aside className="detail-sidebar"><section className="panel"><SectionHeading eyebrow="Keep the paper trail" title="Documents" action={<Link href="/upload" className="icon-button" aria-label="Upload a document"><Upload size={16} /></Link>} />{!hasInvoice && <div className="missing-invoice"><Receipt size={15} /><span>Invoice not saved yet. Keep it close before you need it.</span><Link href="/upload">Upload</Link></div>}<DocumentList documents={documents as DocumentRecord[]} onChanged={() => query.refetch()} /></section><section className="panel panel--soft"><span className="eyebrow">Ownership timeline</span><h3>Small details, kept together.</h3>{events.slice(0, 3).map(event => <p key={event.id} className="timeline-line"><Sparkles size={13} /> {event.description}</p>)}</section></aside>
    </div>
    {editing && <section className="panel detail-editor"><SectionHeading eyebrow="Refine this record" title="Edit details" /><ProductForm product={product} onComplete={() => { setEditing(false); query.refetch(); }} /></section>}
  </div>;
}

export function ReceiptScanPage() {
  const [, setLocation] = useLocation();
  const prepare = trpc.receipt.prepare.useMutation();
  const scan = trpc.receipt.scan.useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraPreview, setCameraPreview] = useState<string | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clearCapturedPhoto = () => {
    setCameraPreview(current => { if (current) URL.revokeObjectURL(current); return null; });
    setCapturedPhoto(null);
  };
  const closeCamera = () => { clearCapturedPhoto(); setCameraReady(false); setCameraOpen(false); };
  useEffect(() => {
    if (!cameraOpen) return;
    let active = true;
    let stream: MediaStream | null = null;
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser does not offer camera capture. Choose a receipt from your device instead.");
        setCameraOpen(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview unavailable");
        video.srcObject = stream;
        await video.play();
        if (active) setCameraReady(true);
      } catch {
        if (active) { setCameraError("We couldn’t open your camera. Check permission, then try again or choose a receipt from your device."); setCameraOpen(false); }
      }
    };
    void start();
    return () => { active = false; stream?.getTracks().forEach(track => track.stop()); };
  }, [cameraOpen]);
  const chooseFile = (candidate?: File) => {
    setError("");
    setCameraError("");
    const validation = validateReceiptCandidate(candidate);
    if (!validation.accepted) { setFile(null); setError(validation.message); return; }
    setFile(validation.file as File);
  };
  const openCamera = () => { setError(""); setCameraError(""); clearCapturedPhoto(); setCameraReady(false); setCameraOpen(true); };
  const captureCameraPhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setCameraError("The camera is still getting ready. Please try again in a moment."); return; }
    const canvas = window.document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) { setCameraError("We couldn’t prepare this photo. Please use the device upload instead."); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) { setCameraError("We couldn’t capture this photo. Please try again or upload the receipt instead."); return; }
      const photo = new File([blob], `receipt-camera-${new Date().toISOString().slice(0, 10)}.jpg`, { type: "image/jpeg" });
      const validation = validateReceiptCandidate(photo);
      if (!validation.accepted) { setCameraError(validation.message); return; }
      clearCapturedPhoto();
      setCapturedPhoto(photo);
      setCameraPreview(URL.createObjectURL(photo));
    }, "image/jpeg", 0.92);
  };
  const confirmCameraPhoto = () => { if (capturedPhoto) { chooseFile(capturedPhoto); closeCamera(); } };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!file) { setError("Choose a receipt or invoice to begin."); return; }
    try {
      const mimeType = file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp";
      await prepare.mutateAsync({ fileName: file.name, mimeType, size: file.size });
      const base64 = await readFileAsBase64(file);
      const review = await scan.mutateAsync({ fileName: file.name, mimeType, size: file.size, base64 });
      setLocation(`/receipt/${review.id}/review`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We couldn't prepare this receipt. Please try again or add the item manually."); }
  };
  const busy = prepare.isPending || scan.isPending;
  return <div className="page receipt-scan-page"><div className="back-link"><Link href="/add"><ChevronRight size={15} className="back-link__icon" /> Back to add</Link></div><div className="receipt-scan-layout"><section><span className="eyebrow">Receipt reader</span><h1>Let the paper<br /><em>do some work.</em></h1><p className="lede">Upload a receipt or invoice and Stashly will bring forward only the details it can read. You stay in charge of every saved field.</p><div className="upload-trust"><ShieldCheck size={16} /><span>Your original stays private in your archive.</span></div></section><form className="upload-dropzone upload-dropzone--connected receipt-scan-dropzone" onSubmit={submit} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); chooseFile(event.dataTransfer.files[0]); }}><div className="upload-dropzone__icon"><Receipt size={25} /></div><span className="eyebrow">Step 1 · choose a receipt</span><h2>{file ? file.name : "Drop a receipt here"}</h2><p>{file ? `${Math.ceil(file.size / 1024)} KB · ready to review` : "PDF, JPG, PNG, or WEBP · up to 10 MB"}</p><input id="stashly-receipt-file" className="visually-hidden" type="file" accept={receiptFileInputSettings.accept} onChange={event => chooseFile(event.currentTarget.files?.[0])} /><div className="receipt-scan-actions"><label className="button button--dark" htmlFor="stashly-receipt-file">{file ? "Choose another file" : "Choose from device"}<Upload size={16} /></label><button className="button button--quiet" type="button" onClick={openCamera}><Camera size={16} />Use camera</button></div>{cameraOpen && <section className="receipt-camera" aria-label="Camera receipt capture"><div className="receipt-camera__heading"><span><Camera size={15} /> Camera capture</span><button type="button" className="text-link" onClick={closeCamera}>Cancel</button></div>{cameraPreview ? <img className="receipt-camera__preview" src={cameraPreview} alt="Captured receipt preview" /> : <div className="receipt-camera__video-wrap"><video className="receipt-camera__video" ref={videoRef} autoPlay playsInline muted />{!cameraReady && <span className="receipt-camera__loading"><Loader2 size={17} className="spin" /> Opening camera…</span>}</div>}<div className="receipt-camera__actions">{cameraPreview ? <><button type="button" className="button button--quiet" onClick={clearCapturedPhoto}>Retake</button><button type="button" className="button button--primary" onClick={confirmCameraPhoto}><ShieldCheck size={16} />Use this photo</button></> : <button type="button" className="button button--primary" disabled={!cameraReady} onClick={captureCameraPhoto}><Camera size={16} />Capture receipt</button>}</div></section>}{cameraError && <p className="form-error">{cameraError}</p>}{busy && <div className="upload-progress"><span><Loader2 size={14} className="spin" /> {prepare.isPending ? "Checking your file…" : "Stashly is reading the document…"}</span><i /></div>}{error && <p className="form-error">{error}</p>}{scan.isError && <p className="form-error">{scan.error.message || "We couldn't read this document. You can still add it manually."}</p>}<button className="button button--primary upload-submit" disabled={!file || busy} type="submit">{busy ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />} Read & review</button><span className="upload-dropzone__note"><ShieldCheck size={14} /> Nothing is added until you review and confirm it.</span></form></div></div>;
}

type ReceiptReviewValues = { name: string; brand: string; model: string; category: string; purchasedAt: string; purchasePrice: string; currency: string; purchasedFrom: string; invoiceNumber: string; serialNumber: string; warrantyMonths: string; returnPeriodDays: string; };
const receiptValues = (extraction?: ReceiptExtractionRecord): ReceiptReviewValues => ({ name: extraction?.name ?? "", brand: extraction?.brand ?? "", model: extraction?.model ?? "", category: extraction?.category ?? "", purchasedAt: extraction?.purchasedAt ?? "", purchasePrice: extraction?.purchasePrice === null || extraction?.purchasePrice === undefined ? "" : String(extraction.purchasePrice), currency: extraction?.currency ?? "", purchasedFrom: extraction?.purchasedFrom ?? "", invoiceNumber: extraction?.invoiceNumber ?? "", serialNumber: extraction?.serialNumber ?? "", warrantyMonths: extraction?.warrantyMonths === null || extraction?.warrantyMonths === undefined ? "" : String(extraction.warrantyMonths), returnPeriodDays: extraction?.returnPeriodDays === null || extraction?.returnPeriodDays === undefined ? "" : String(extraction.returnPeriodDays) });

function ReceiptReviewForm({ review, onRetry }: { review: ReceiptReviewRecord; onRetry: () => void }) {
  const [, setLocation] = useLocation();
  const [values, setValues] = useState<ReceiptReviewValues>(() => receiptValues(review.extraction));
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [finished, setFinished] = useState(false);
  const confirm = trpc.receipt.confirm.useMutation({ onSuccess: product => { if (!product) return; setFinished(true); window.setTimeout(() => setLocation(`/product/${product.id}`), 900); } });
  const extractionKey = JSON.stringify(review.extraction ?? null);
  useEffect(() => { setValues(receiptValues(review.extraction)); }, [review.id, extractionKey]);
  const retry = trpc.receipt.retry.useMutation({ onSuccess: refreshedReview => { setValues(receiptValues(refreshedReview.extraction)); setReviewed(false); onRetry(); } });
  const fieldStatus = (field: keyof ReceiptReviewValues) => getReceiptFieldEvidenceStatus(field, values[field], review.extraction?.uncertainFields);
  const change = (field: keyof ReceiptReviewValues, value: string) => setValues(current => ({ ...current, [field]: value }));
  const missingName = submitted && !values.name.trim();
  const missingCategory = submitted && !values.category.trim();
  const missingCurrency = submitted && !!values.purchasePrice && !values.currency.trim();
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(true); if (!values.name.trim() || !values.category.trim() || (!!values.purchasePrice && !values.currency.trim()) || !reviewed) return; confirm.mutate({ documentId: review.id, product: { name: values.name.trim(), brand: values.brand.trim() || undefined, model: values.model.trim() || undefined, category: values.category.trim(), purchasedAt: values.purchasedAt || undefined, purchasePrice: values.purchasePrice ? Number(values.purchasePrice) : undefined, currency: values.currency.trim().toUpperCase() || undefined, purchasedFrom: values.purchasedFrom.trim() || undefined, invoiceNumber: values.invoiceNumber.trim() || undefined, serialNumber: values.serialNumber.trim() || undefined, warrantyMonths: values.warrantyMonths ? Number(values.warrantyMonths) : undefined, returnPeriodDays: values.returnPeriodDays ? Number(values.returnPeriodDays) : undefined } }); };
  const label = (title: string, field: keyof ReceiptReviewValues) => <span className="receipt-review-label">{title}<em className={fieldStatus(field) === "read" ? "receipt-field-status receipt-field-status--read" : "receipt-field-status"}>{fieldStatus(field) === "read" ? "Read from receipt" : "Review needed"}</em></span>;
  if (finished) return <div className="stashly-success receipt-review-success"><ShieldCheck size={22} /><span className="eyebrow">Reviewed & saved</span><h2>Added with care.</h2><p>Your receipt is attached to the product’s paper trail.</p></div>;
  const reviewState = getReceiptReviewState(review.extraction);
  return <form className="product-form receipt-review-form" onSubmit={submit} noValidate><div className="receipt-review-notice" data-review-required={reviewState.requiresReview ? "true" : "false"}><Receipt size={17} /><span><strong>{review.extraction?.source === "ocr" ? `${Math.round(review.extraction.confidence)}% OCR confidence` : review.extraction?.source === "llm" ? `${Math.round(review.extraction.confidence)}% confidence` : "Manual review needed"}</strong>{reviewState.lowConfidence ? " · Low confidence: please check the marked fields or read the receipt again." : " · Stashly only brought forward details it could read. Please check each field before saving."}</span></div>{review.extractionError && <p className="form-error">{review.extractionError} Add any details you know below, or return to manual entry.</p>}<div className="product-form__grid"><label className={missingName ? "auth-field auth-field--error" : "auth-field"}>{label("Product name", "name")}<input value={values.name} onChange={event => change("name", event.target.value)} placeholder="Required to save" />{missingName && <small>Give this item a name so you can find it later.</small>}</label><label className={missingCategory ? "auth-field auth-field--error" : "auth-field"}>{label("Category", "category")}<select value={values.category} onChange={event => change("category", event.target.value)}><option value="">Choose a category</option><option>Electronics</option><option>Home</option><option>Wearables</option><option>Photography</option><option>Gaming</option><option>Other</option></select>{missingCategory && <small>Choose the category you think fits best.</small>}</label><label className="auth-field">{label("Brand", "brand")}<input value={values.brand} onChange={event => change("brand", event.target.value)} placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Model", "model")}<input value={values.model} onChange={event => change("model", event.target.value)} placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Purchase date", "purchasedAt")}<input value={values.purchasedAt} onChange={event => change("purchasedAt", event.target.value)} type="date" /></label><label className="auth-field">{label("Price", "purchasePrice")}<input value={values.purchasePrice} onChange={event => change("purchasePrice", event.target.value)} type="number" min="0" step="0.01" placeholder="Not shown on receipt" /></label><label className={missingCurrency ? "auth-field auth-field--error" : "auth-field"}>{label("Currency", "currency")}<select value={values.currency} onChange={event => change("currency", event.target.value)}><option value="">Choose if adding price</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option><option value="INR">INR</option><option value="CAD">CAD</option><option value="AUD">AUD</option></select>{missingCurrency && <small>Select the receipt currency before saving the price.</small>}</label><label className="auth-field">{label("Retailer", "purchasedFrom")}<input value={values.purchasedFrom} onChange={event => change("purchasedFrom", event.target.value)} placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Warranty (months)", "warrantyMonths")}<input value={values.warrantyMonths} onChange={event => change("warrantyMonths", event.target.value)} type="number" min="0" max="240" placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Return period (days)", "returnPeriodDays")}<input value={values.returnPeriodDays} onChange={event => change("returnPeriodDays", event.target.value)} type="number" min="0" max="365" placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Invoice number", "invoiceNumber")}<input value={values.invoiceNumber} onChange={event => change("invoiceNumber", event.target.value)} placeholder="Not shown on receipt" /></label><label className="auth-field">{label("Serial number", "serialNumber")}<input value={values.serialNumber} onChange={event => change("serialNumber", event.target.value)} placeholder="Not shown on receipt" /></label></div><label className={submitted && !reviewed ? "receipt-review-check receipt-review-check--error" : "receipt-review-check"}><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} /><span>I’ve reviewed these details and want to add this item to my stash.</span></label>{confirm.error && <p className="form-error">{confirm.error.message || "We couldn't save this item. Please try again."}</p>}{retry.error && <p className="form-error">{retry.error.message || "We couldn't read this receipt again. Please try again or enter the details manually."}</p>}<div className="receipt-review-submit"><button className="button button--dark" disabled={confirm.isPending} type="submit">{confirm.isPending ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />} Add to my stash</button><button className="button button--quiet" disabled={retry.isPending || confirm.isPending} type="button" onClick={() => retry.mutate({ id: review.id })}>{retry.isPending ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}{retry.isPending ? "Reading receipt…" : "Retry reading receipt"}</button><Link href="/add/manual" className="text-link">Start manually instead <ArrowUpRight size={14} /></Link></div></form>;
}

export function ReceiptReviewPage({ documentId }: { documentId: number }) {
  const query = trpc.receipt.getReview.useQuery({ id: documentId });
  if (query.isLoading) return <SoftLoading label="Preparing your receipt review…" />;
  if (query.isError || !query.data) return <SoftError retry={() => query.refetch()} copy="We couldn't open this receipt review. You can try again or add the item manually." />;
  const review = query.data as ReceiptReviewRecord;
  return <div className="page receipt-review-page"><div className="back-link"><Link href="/scan"><ChevronRight size={15} className="back-link__icon" /> Start with another receipt</Link></div><div className="receipt-review-layout"><section><span className="eyebrow">Step 2 · your review</span><h1>Keep what’s<br /><em>actually useful.</em></h1><p className="lede">Fields marked for review were missing or uncertain. Nothing is added until you confirm the record.</p><div className="receipt-source-slip"><Receipt size={17} /><span>{review.name}</span></div></section><section className="panel receipt-review-panel"><SectionHeading eyebrow="Receipt details" title="Take a careful look" /><ReceiptReviewForm review={review} onRetry={() => query.refetch()} /></section></div></div>;
}
