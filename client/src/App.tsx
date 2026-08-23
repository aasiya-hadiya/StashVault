// Soft Archive direction: Stashly is a warm editorial ownership app with an archive rail, pastel surfaces, and honest Phase 1 shells.
import { useLayoutEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";

const visibleBrandText = new Map<string, string>([
  ["Ask Stashly", "Ask StashVault"],
  ["Stashly is being shaped around your real life.", "StashVault is being shaped around your real life."],
  ["Stashly helps you remember what you bought, when it needs care, and what to do next.", "StashVault helps you remember what you bought, when it needs care, and what to do next."],
  ["Upload it once. Stashly will keep the dates, documents, and next steps together.", "Upload it once. StashVault will keep the dates, documents, and next steps together."],
  ["A small thought from Stashly", "A small thought from StashVault"],
  ["Ask Stashly for help", "Ask StashVault for help"],
  ["Stashly brings forward only the details it can read. You review every field before saving.", "StashVault brings forward only the details it can read. You review every field before saving."],
  ["Drop a receipt here and Stashly will be ready to understand it when the next phase opens.", "Drop a receipt here and StashVault will be ready to understand it when the next phase opens."],
  ["Illustrated Stashly dashboard showing products and protection status", "Illustrated StashVault dashboard showing products and protection status"],
  ["Why Stashly", "Why StashVault"],
  ["Stashly keeps your receipts, warranties, return windows and product history in one intelligent place — and helps you take action when something goes wrong.", "StashVault keeps your receipts, warranties, return windows and product history in one intelligent place — and helps you take action when something goes wrong."],
  ["Stashly benefits", "StashVault benefits"],
  ["Stashly turns the paper trail of everyday life into a calm, useful record you can act on.", "StashVault turns the paper trail of everyday life into a calm, useful record you can act on."],
  ["Stashly remembers", "StashVault remembers"],
  ["Invoices get lost in inboxes. Warranties quietly expire. Return windows close while products sit in a drawer. Stashly gives the details a home before they become a problem.", "Invoices get lost in inboxes. Warranties quietly expire. Return windows close while products sit in a drawer. StashVault gives the details a home before they become a problem."],
  ["The Stashly way", "The StashVault way"],
  ["Stashly checks the ownership information you already saved and brings the useful answer forward.", "StashVault checks the ownership information you already saved and brings the useful answer forward."],
  ["If something breaks, Stashly helps you understand whether it can be repaired or claimed under warranty before you replace it.", "If something breaks, StashVault helps you understand whether it can be repaired or claimed under warranty before you replace it."],
  ["© 2026 Stashly", "© 2026 StashVault"],
  ["Stashly keeps the useful details close, so your things can keep doing their thing.", "StashVault keeps the useful details close, so your things can keep doing their thing."],
  ["Stashly · Personal ownership assistant", "StashVault · Personal ownership assistant"],
  ["New to Stashly? ", "New to StashVault? "],
  ["Ask Stashly.", "Ask StashVault."],
  ["When something needs care, Stashly will help you understand the most useful next step before you replace it.", "When something needs care, StashVault will help you understand the most useful next step before you replace it."],
  ["Add your own first item, or load a small private sample stash to explore Stashly.", "Add your own first item, or load a small private sample stash to explore StashVault."],
  ["Start with what you know. Stashly will hold the dates, coverage, and small details together.", "Start with what you know. StashVault will hold the dates, coverage, and small details together."],
  ["Save to Stashly", "Save to StashVault"],
  ["Upload a receipt or invoice and Stashly will bring forward only the details it can read. You stay in charge of every saved field.", "Upload a receipt or invoice and StashVault will bring forward only the details it can read. You stay in charge of every saved field."],
  ["Stashly is reading the document…", "StashVault is reading the document…"],
  [" · Stashly only brought forward details it could read. Please check each field before saving.", " · StashVault only brought forward details it could read. Please check each field before saving."],
  ["Sign out of Stashly", "Sign out of StashVault"],
]);

function replaceVisibleBrandText(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const replacement = visibleBrandText.get(node.textContent ?? "");
    if (replacement) node.textContent = replacement;
    return;
  }
  if (!(node instanceof Element)) return;
  for (const attribute of ["aria-label", "title"]) {
    const replacement = visibleBrandText.get(node.getAttribute(attribute) ?? "");
    if (replacement) node.setAttribute(attribute, replacement);
  }
  node.childNodes.forEach(replaceVisibleBrandText);
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Home} />
      <Route path={"/signup"} component={Home} />
      <Route path={"/dashboard"} component={Home} />
      <Route path={"/stash"} component={Home} />
      <Route path={"/product/:id"} component={Home} />
      <Route path={"/add"} component={Home} />
      <Route path={"/add/manual"} component={Home} />
      <Route path={"/scan"} component={Home} />
      <Route path={"/receipt/:id/review"} component={Home} />
      <Route path={"/upload"} component={Home} />
      <Route path={"/risk-radar"} component={Home} />
      <Route path={"/documents"} component={Home} />
      <Route path={"/ask-stashly"} component={Home} />
      <Route path={"/before-you-buy"} component={Home} />
      <Route path={"/repair"} component={Home} />
      <Route path={"/settings"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  useLayoutEffect(() => {
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" || record.type === "characterData") replaceVisibleBrandText(record.target);
        else record.addedNodes.forEach(replaceVisibleBrandText);
      }
    });
    replaceVisibleBrandText(document.body);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["aria-label", "title"] });
    return () => observer.disconnect();
  }, []);
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
