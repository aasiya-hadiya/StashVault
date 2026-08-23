# Stashly Design Direction

## Three Initial Approaches

### Theme Name: Soft Archive
**Very Brief Intro:** A warm editorial system inspired by premium stationery, personal archives, and quiet rituals of keeping. Blush, sage, and cream surfaces make ownership feel calm, considered, and human.

**Probability:** 0.07

### Theme Name: Sunday Shelf
**Very Brief Intro:** A lifestyle-catalog direction where every product feels curated on a shelf: tactile materials, soft daylight, and asymmetrical compositions create an optimistic sense of order.

**Probability:** 0.04

### Theme Name: Quiet Signal
**Very Brief Intro:** A restrained, monochrome-first utility interface with tiny pastel signals for risk, warranty, and attention. It feels precise and composed without becoming corporate.

**Probability:** 0.02

## Chosen Approach: Soft Archive

### Design Movement
Contemporary editorial design blended with neocraft stationery and premium lifestyle-app minimalism. The interface should feel like a beautifully maintained personal archive rather than a generic SaaS dashboard.

### Core Principles
1. **Make remembering feel beautiful.** Product ownership is everyday maintenance, so the UI should turn forgotten details into calm, visually legible rituals.
2. **Use softness as hierarchy.** Pastel surfaces, tactile borders, and quiet shadowing should establish priority without shouting.
3. **Compose with editorial asymmetry.** Use a persistent left rail on desktop, offset content blocks, and generous negative space rather than a centered dashboard grid.
4. **Make every control feel intentional.** Interactions are short, clear, and tactile; no decorative motion competes with the user’s next action.

### Color Philosophy
Warm cream is the canvas: it keeps the product personal and paper-like. Dusty blush acts as the signature memory cue, sage signals safe/kept/healthy, and muted lavender marks future-facing intelligence. Sand and soft peach provide low-contrast depth. Deep charcoal is reserved for reading, so the pastel palette stays sophisticated and accessible rather than candy-like.

### Layout Paradigm
The desktop experience uses a slim archive rail on the left and a spacious working canvas on the right. Within the canvas, a large editorial lead card anchors each page while supporting cards sit in offset columns. Mobile collapses the rail into a bottom dock, with the Add action floating as the visual hinge between browsing and capturing.

### Signature Elements
- **Archive tabs:** small blush, sage, and lavender tab labels that feel like dividers in a paper filing system.
- **Receipt slips:** quiet dashed borders, stamped status pills, and small metadata clusters that echo kept documents without imitating a literal spreadsheet.
- **Memory spark:** a tiny four-point spark motif used only for AI/insight moments, never as decoration everywhere.

### Interaction Philosophy
Interactions should feel like placing something carefully on a shelf. Buttons press in slightly, cards lift by a few pixels, and status changes use a short fade/slide rather than a loud transformation. Placeholder actions are honest and friendly, explaining that the capability is being prepared instead of pretending a backend exists.

### Animation
Use 180–240ms ease-out transitions for buttons, nav states, and cards. Page-level content can reveal with a 30–60ms stagger per block, combining opacity and a small vertical transform. Modals and sheets should enter from 95% scale with opacity, never from zero. Respect `prefers-reduced-motion` and keep all interactions useful at rest.

### Typography System
Use **DM Serif Display** for the Stashly wordmark, page titles, and short editorial headlines. Use **Manrope** for body copy, navigation, metadata, controls, and status text. Headings should be compact and expressive; supporting text should use a generous line height. Keep labels in sentence case with modest tracking rather than all-caps noise.

### Brand Essence
**Positioning:** Stashly is the thoughtful ownership assistant for people who want the things they buy to stay useful, protected, and easy to remember.

**Personality:** Considered, warm, quietly clever.

### Brand Voice
Headlines should sound observant and reassuring. CTAs should describe the next helpful action, not pressure the user. Microcopy should be specific, kind, and lightly conversational.

Example lines:
- “A calmer way to keep what you own in view.”
- “Save the receipt now. Thank yourself later.”

### Wordmark & Logo
The wordmark uses a high-contrast serif with a slightly widened final “y” rhythm and generous tracking, paired with a small archive-tab mark. The mark is a compact geometric fold: a receipt corner tucked into a box with one small memory spark, designed to work as a favicon and compact navigation glyph.

### Signature Brand Color
**Rose Archive — `#C9878C`**. A muted dusty rose that feels like a saved note or a well-loved file tab: ownable, calm, and distinct from the generic blue of productivity software.

## Implementation Reminder

All component/page files should carry a short style reminder at the top: Soft Archive editorial design; DM Serif Display + Manrope; warm cream canvas; Rose Archive as the signature accent; asymmetrical archive-rail layout; restrained motion; no generic blue SaaS styling.

## Style Decisions

- Rose Archive `#C9878C` leads capture, memory, and active states; sage and lavender remain semantic supporting signals.
- Core app pages use at least one visible archive/stationery cue: receipt slips, archive tabs, stamped metadata, dashed document edges, or clustered ownership details.
- Desktop layouts use an editorial lead area and offset supporting blocks instead of allowing equal-weight grids to dominate.
