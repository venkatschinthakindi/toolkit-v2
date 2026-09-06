# Dark/Light Theme Migration — Progress

**Branch:** `feature/dark-light-theme-migration` (created off
`refactor/shared-ui-components-v2` — not merged anywhere; merge back into
`refactor/shared-ui-components-v2` is done manually by the repo owner when
ready). `main` is never touched by this effort.

**Relationship to `REFACTOR_PROGRESS.md`:** that file tracks the unrelated
shared-UI-component dedup effort on `refactor/shared-ui-components-v2`.
This is a separate, distinct effort (styling/theming, not deduplication),
so it gets its own progress file to avoid conflating two different
workstreams in one doc. Cross-referenced here for anyone who lands on one
file looking for the other.

**Standing rules for this entire effort** (from the task brief):
- ~~Never touch any `*SeoContent*.tsx` file.~~ **REVERSED as of session 32,
  by explicit repo-owner confirmation** — `*SeoContent*.tsx` files are now
  in scope for color-token migration, same rigor as everything else
  (styling/tokens only, no copy/content changes). **If you are a session
  that started before this note existed, re-read this before skipping
  any SeoContent file** — the old exclusion no longer applies. See
  "Session 32" below for the confirmation and first files done under the
  new rule.
- No business/calculation logic changes — styling/theming only. If a file
  mixes logic and styling, touch only the styling.
- **One file (or one truly atomic small change) per commit, committed and
  pushed immediately** — not batched until a phase/family feels "done."
  Verify with `tsc`/`eslint` first, then commit+push right away, then
  move to the next file. (Updated per explicit instruction during
  session 2 — supersedes the looser "one tool family per commit"
  framing below.)
- `npx tsc --noEmit` after every file change; `npx eslint <changed files>`
  before moving on — not batched at the end.
- Git workflow: `git fetch` + check `git merge-base --is-ancestor` before
  every push; rebase if the remote moved; re-run full `tsc`/`eslint` after
  any rebase, not just changed files. Never touch `main` or
  `refactor/shared-ui-components-v2` directly — this branch only.
- Keep this file in sync after every step.

---

## Session 1 — state verification + audit (no code changes yet, per instructions)

### 1. Verified existing state (confirmed accurate as of 2026-08-30)

- **Tailwind v4, CSS-first config** — confirmed. No `tailwind.config.*`
  file exists anywhere in the repo; `package.json` has
  `"tailwindcss": "^4.3.1"` and `"next": "^16.2.9"`.
- **`src/app/globals.css`** (960 lines) already contains a complete
  shadcn/ui light+dark CSS-variable token system:
  - `@custom-variant dark (&:is(.dark *));` at the top (line 6) — the
    `dark:` variant infrastructure is already wired, just unused.
  - `@theme inline { ... }` block (lines 8–50) mapping `--color-*` theme
    tokens to CSS custom properties.
  - `:root { ... }` (lines 62–95) — light-mode values for `--background`,
    `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`,
    `--muted`, `--accent`, `--destructive`, `--border`, `--input`,
    `--ring`, `--chart-1..5`, `--sidebar*`.
  - `.dark { ... }` (lines 97–129) — dark-mode values for the exact same
    token set.
  - A separate, smaller `:root` block above that (lines 51–61) holds
    app-specific tokens that are **not** light/dark-aware yet: `--radius`,
    `--app-max-width`, `--glass-bg`, `--glass-border`, `--aurora-purple`,
    `--aurora-cyan`. These will need their own light-mode values or a
    decision that they stay constant across themes.
- **Token system is confirmed unused** — `grep -r "bg-background\|text-foreground\|bg-card\|text-card-foreground"` across `src/components` and `src/app` (excluding this token definition file itself) returns no product-component matches.
- **No theme library installed** — confirmed no `next-themes` (or any
  theme package) in `package.json`, no `ThemeProvider` anywhere in `src/`.
- **`<html>` never gets a `dark` class** — confirmed in
  `src/app/layout.tsx`: the `<html>` tag's `className` is
  `cn("h-full", "antialiased", "font-mono", jetbrainsMono.variable)` —
  static, no theme class logic at all.

All of the above matches the brief's stated context exactly. Nothing had
changed since the brief was written.

### 2. Full hardcoded-color audit

Two separate categories were audited, since they have different migration
implications:

**A. Surface / text / border grayscale utilities** (the "does this need a
real semantic surface token" category — `bg-slate-*`, `bg-zinc-*`,
`bg-gray-*`, `bg-neutral-*`, `bg-stone-*`, `bg-black`, `bg-white`,
`text-white`, `text-black`, `border-white`, `border-black`, all with
opacity modifiers). **138 files, ~2,241 occurrences repo-wide** (excluding
`*SeoContent*` files), broken down by area:

| Area | Files | Occurrences |
|---|---:|---:|
| `src/components/ui/` (shared kit) | 35 | ~277 |
| `src/sharedUI/` (this repo's newer shared components) | 32 | ~175 |
| `src/app/` (route pages, layout, static pages) | 13 | ~489 |
| `src/components/tools/financeSuite/` | 15 | ~235 |
| `src/components/tools/image/` | 6 | ~196 |
| `src/components/tools/dateTime/` | 3 | ~204 |
| `src/components/tools/pdf/` | 4 | ~148 |
| `src/components/tools/emiCalculator/` | 2 | ~118 |
| `src/components/tools/calculator/` | 3 | ~103 |
| `src/components/tools/qrCode/` | 7 | ~94 |
| `src/components/report/` (file-checkup report UI) | 5 | ~63 |
| `src/components/tools/privacysecurity/` | 4 | ~52 |
| `src/components/tools/converter/` | 1 | ~47 |
| `src/components/pwa/`, `src/components/layout/`, `src/components/favorites/`, `src/components/dashboard/`, `src/utility/seo/SectionHeading.tsx` (misc, not tool-family-specific) | 8 | ~40 |

**B. Accent/brand colors** (`bg-blue-*`, `text-emerald-*`,
`border-violet-*`, etc. — colors that carry meaning/branding rather than
being a surface, e.g. QR's green, finance's blue/violet gradients, image
tools' blue accents). **100 files, ~948 occurrences.** This is a distinct
concern from (A): these mostly won't need to flip entirely between
themes, but several will need adjusted lightness/saturation for WCAG AA
contrast against a light background (a `text-emerald-300` that reads fine
on `bg-slate-950` will likely fail contrast on a white surface).

**C. Edge cases (brief's phase 5)** — checked explicitly:
- **Inline `style={{ color: ... }}`**: **zero** found anywhere in scope.
- **Hardcoded SVG `fill`/`stroke`** (hex or literal `white`/`black`, not
  `currentColor`): **zero** found anywhere in scope.
- **Chart libraries**: exactly 2 files use Chart.js —
  `src/components/tools/financeSuite/financeChart.tsx` and
  `src/components/tools/emiCalculator/AmortizationChart.tsx` (already
  counted in the financeSuite/emiCalculator rows above for their Tailwind
  usage). Both currently **omit explicit legend/tick/tooltip text colors**
  in their Chart.js options objects — meaning both are silently relying on
  Chart.js's own built-in default text color, not a value from this
  codebase. This needs to become an explicit, theme-aware color read from
  the resolved CSS variables (e.g. via `getComputedStyle` at chart-render
  time) during the actual migration — omission won't "just work" via CSS
  the way Tailwind classes do, since Chart.js paints text directly to
  `<canvas>`.

**Total scope:** roughly **150 unique files** need touching (138 ∪ 100,
accounting for overlap between the two categories), for an estimated
**~3,200 total color-utility occurrences** across both categories.

### 3. Recommendation on scope (continuous effort vs. multiple sessions)

Given ~150 files and ~3,200 occurrences, this should be **multiple
sessions/commits, not one continuous pass** — consistent with the brief's
own "one tool family per commit" rule. Rough sizing per phase-4 migration
order:

1. `src/components/ui/` + `src/sharedUI/` (shared kit) — 67 files, ~452
   occurrences. Highest leverage: every tool consumes these.
2. `src/app/` (layout, static pages, route shells) — 13 files, ~489
   occurrences. Second priority since it wraps every page.
3. `dateTime` → `pdf` → `image` → `calculator`/`emiCalculator`/
   `financeSuite` → `qrCode` → `privacysecurity`/`converter` — per the
   brief's stated order, ~2,150 occurrences total across these 6 families.
4. `src/components/report/`, PWA, layout dock, favorites, dashboard — the
   smaller "misc" bucket, ~103 occurrences, can go last or be folded into
   whichever family uses them most (`report/` is used by
   `privacysecurity`'s file-checkup tool).
5. Chart.js color injection (2 files) — do this alongside whichever family
   commit touches `financeSuite`/`emiCalculator`, since it's the same
   files.

This is not started yet — proposed order only, pending confirmation.

---

## Proposed semantic token vocabulary (for review — nothing implemented yet)

Extending the **existing** `:root`/`.dark` blocks in `globals.css`, not
replacing them. shadcn's existing tokens (`--background`, `--foreground`,
`--card`, `--border`, `--muted`, etc.) stay and get used where they
already map naturally (e.g. `--muted-foreground` for secondary text).
New tokens proposed to cover this codebase's actual layered-surface
pattern, which is more granular than shadcn's defaults:

**Surfaces** (replacing `bg-slate-950`, `bg-black/20-80`, `bg-white/5-10`
patterns seen across the audit):
- `--surface-app` — the page-level background (currently the
  `bg-slate-950` / gradient app shell).
- `--surface-panel` — the standard card/panel background (currently
  `bg-white/5` or `bg-black/20`, used almost everywhere as the primary
  "content card" surface).
- `--surface-raised` — hover/active/elevated state on interactive
  elements (currently `bg-white/10`).
- `--surface-sunken` — nested/inset areas inside a panel, like the
  finance calculators' input-group backgrounds (currently `bg-black/30`,
  `bg-black/40`, or `bg-slate-950/60`).
- `--surface-overlay` — modal/dialog backdrops (currently `bg-black/60`
  to `bg-black/80`).

**Text:**
- `--text-primary` — main content text (currently `text-white`).
- `--text-secondary` — secondary/body text (currently `text-white/70`
  to `text-white/80`).
- `--text-muted` — de-emphasized text, labels (currently `text-white/40`
  to `text-white/60`).
- `--text-faint` — hint/caption text, least emphasis (currently
  `text-white/30` to `text-white/35`).

**Borders:**
- `--border-default` — standard dividers/outlines (currently
  `border-white/10`).
- `--border-strong` — emphasized borders, e.g. focus/active states
  (currently `border-white/20` to `border-white/30`).

**Accents** — proposed to stay **per-tool-family named tokens** rather
than one global accent, since the audit confirmed real intentional
branding differences (QR's green, finance's blue/violet gradients, image
tools' blue, PDF's similar blue/glass treatment):
- `--accent-finance` (blue/violet family — savings & investment
  calculators' current `blue-400`/`violet-400`/`cyan-400`/`emerald-400`
  usage collapses into a small defined set here, not one single token).
- `--accent-image` (blue family, image/PDF tool consoles).
- `--accent-qr` (green family, QR tool's existing brand color).
- Plus reuse of shadcn's existing `--destructive` for error/danger states
  already used consistently for validation errors across forms.

**Status colors** (currently ad hoc emerald/amber/red per file):
- `--status-success` (currently `emerald-300`/`emerald-400`, used
  consistently for "reduced by X%" / positive deltas).
- `--status-warning` (currently `amber-*`, used for caveats/disclaimers).
- `--status-danger` — likely just aliases shadcn's existing
  `--destructive` rather than a new token.

**Non-color tokens already present but not yet theme-aware** — flagged for
a decision, not yet resolved: `--glass-bg` / `--glass-border` (used for
the "glass" panel treatment seen in several hero sections) and
`--aurora-purple` / `--aurora-cyan` (used for background glow/blur
effects). These may need light-mode-specific values (a glow designed for
a dark backdrop can look muddy or invisible on white) rather than simply
being reused as-is — flagged in the brief's phase 5 as a "genuinely
different, not just inverted" case.

**Not yet decided, needs your input:** exact OKLCH values for each new
token in both `:root` and `.dark`, and the final accent-token count (is
"finance" one token or should savings vs. investment vs. retirement get
their own, given they already use different gradient combinations today?).

---

## Explicitly not started yet
- No `next-themes` install, no `ThemeProvider`, no toggle UI.
- No component migration.
- No Lighthouse baseline captured yet (should be done before touching
  anything, per the brief's own "before and after" requirement — this is
  the next concrete step once the token vocabulary above is confirmed).

---

## Session 2 — phases 1 & 2: token values + theme infrastructure

### Design decisions confirmed by repo owner before implementation
- **Finance accents:** one shared `--accent-finance` palette rather than
  each calculator (savings/investment/retirement) keeping its own
  distinct gradient. Simplifies the accent surface significantly.
- **Glass/aurora light-mode values:** designed properly now, not deferred
  or reused-as-is from dark. See values below.

### Phase 1 — token vocabulary implemented (commit `aa1820b`)
Extended (not replaced) the existing `:root`/`.dark` blocks in
`globals.css`. Reused existing shadcn tokens wherever they already fit
rather than duplicating: `--surface-app` → `--background`,
`--surface-panel` → `--card`, primary text → `--foreground`, muted text
→ `--muted-foreground`, default border → `--border`, danger status →
`--destructive`. Genuinely new tokens added (both themes, registered in
`@theme inline` for Tailwind utility generation):

- Surfaces: `--surface-raised`, `--surface-sunken`, `--surface-overlay`
- Text: `--foreground-secondary`, `--foreground-faint`
- Borders: `--border-strong`
- Accents: `--accent-finance`/`-soft`, `--accent-image`/`-soft`,
  `--accent-qr`/`-soft`
- Status: `--status-success`/`-soft`, `--status-warning`/`-soft`

`--glass-bg`/`--glass-border`/`--aurora-purple`/`--aurora-cyan` moved out
of the old theme-invariant `:root` block into the real themed blocks,
with genuinely different (not inverted) light-mode values: a low-opacity
dark tint for glass (`rgba(15, 23, 42, ...)` instead of white — a
white-on-white glass effect would be invisible), and softer pastel hues
for the aurora glow (violet-300/cyan-200-equivalent instead of the dark
theme's fully saturated violet-500/cyan-500, which would look muddy at
low opacity on a white backdrop).

**Real bug caught during verification, not by `tsc` (CSS isn't
type-checked) but by actually running `npm run build`:** an explanatory
CSS comment containing the literal substring `bg-black/*/bg-white/*`
accidentally closed and reopened the CSS comment block mid-sentence,
producing a genuine PostCSS syntax error (`Unknown word --surface-raised`).
Fixed by rewording the comment. **Lesson for future sessions: `tsc
--noEmit` does not catch CSS syntax errors — run a real `next build` (or
at least a standalone PostCSS pass) after any `globals.css` edit, not
just `tsc`.**

### Phase 2 — theme infrastructure implemented (commit `30da656`)
- Installed `next-themes@0.4.6`.
- `src/components/theme/ThemeProvider.tsx` — thin wrapper: `attribute="class"`,
  `defaultTheme="dark"`, `enableSystem`, `disableTransitionOnChange`.
- `src/app/layout.tsx` — wraps body content in `ThemeProvider`, added
  `suppressHydrationWarning` on `<html>` (required, standard, one-node-only
  fix for the class-attribute mismatch next-themes' blocking script
  causes before hydration), made `viewport.themeColor` respond to
  `prefers-color-scheme` via a media-query array instead of one hardcoded
  black value.
- `src/components/theme/ThemeToggle.tsx` — a custom "Aurora Eclipse"
  toggle (not a generic sun/moon icon swap), per the brief's ask for a
  distinctive design tied to this app's own visual language: the track
  is tinted with the app's own `--aurora-purple`/`--aurora-cyan` tokens,
  the knob morphs between a crescent moon (two overlapping circles, no
  image/mask) with star flecks on the track, and a sun disc with a warm
  gradient and sparkle accents. No animation library — pure Tailwind +
  a few inline gradient/shadow styles, keeping bundle size and TBT down.
  Includes the standard next-themes mounted-guard pattern (fixed-size
  placeholder, zero CLS on swap-in) and full switch a11y semantics.
- `src/components/layout/floatingDock.tsx` — added the toggle to the one
  shared nav dock rendered by `AppShell`.

**Decision flagged for review — toggle placement:** the brief said "every
page except home page should be aligned... and should have option to
switch." Confirmed `AppShell` (which renders `FloatingDock`, where the
toggle now lives) is used by **the home page too** (`src/app/page.tsx`
line 73). Interpreted "except home page" as applying only to the
padding/spacing-alignment clause, not the toggle-availability clause —
i.e., the toggle is available everywhere including home, since excluding
it there would mean users can't switch theme from the home page at all.
**If this interpretation is wrong, this is a one-line revert** (remove
`<ThemeToggle />` from `FloatingDock` and add it to a home-page-specific
element instead) — not a structural change.

**Decision flagged for review — system-preference vs. dark-default
priority:** the brief said "respect prefers-color-scheme for first-time
visitors, but the app's default... should be dark" — genuinely readable
two ways (does system-light win for a first-time visitor with no stored
choice, or does dark always win until they manually opt into light?).
Implemented the standard, industry-common reading: `enableSystem` honors
OS preference for first-time visitors, `defaultTheme="dark"` is only the
fallback when system preference can't be determined. **If dark should
always win over system preference for first-time visitors instead, this
is a one-line change:** `enableSystem={false}` in `ThemeProvider.tsx`.

**Verification:** `tsc --noEmit` clean on every file; `eslint` clean
(one justified inline-commented suppression for next-themes' standard,
unavoidable mounted-guard `setState`-in-effect pattern — this exact
pattern is the documented way to detect "mounted on client" and has no
alternative). A full `npm run build` gets past all CSS/JS compilation
now — the only remaining failure is the pre-existing Google Fonts
sandbox network restriction (not caused by this work, reproduced on
unmodified code in earlier sessions of the other refactor effort too).

**Could not do in this sandbox:** any real browser/Lighthouse visual
check — the sandbox has no network route to fonts.googleapis.com, which
blocks even `next dev` from fully rendering a page. **Before merging,
someone needs to:**
1. Run `npm run dev` locally and manually toggle the theme on a few
   pages to confirm no visual bugs, confirm zero flash-of-wrong-theme on
   reload, and confirm the toggle looks right at mobile/tablet/desktop
   widths.
2. Run Lighthouse (or equivalent) on at least one page in both themes to
   establish the baseline the brief asks for, before phase 4 migration
   begins.
3. Sanity-check the two flagged interpretation decisions above.

### Not started yet
- Phase 3 (full per-file audit was already done in session 1 as part of
  the deliverable, ahead of the brief's phase ordering — see the numbers
  above in this file).
- Phase 5 (edge cases: Chart.js color injection for the 2 chart files
  identified in session 1).
- Phase 6 (regression pass, Lighthouse before/after per family).

---

## Session 3 — phase 4: shared-kit component migration (in progress)

Per the mid-session-2 rule change, each file below is its own commit,
pushed immediately after `tsc`/`eslint` verification — not batched. Log
kept here so the per-file reasoning isn't lost to git history alone.

**Shared-kit files migrated so far** (`src/components/ui/` +
`src/sharedUI/`, ~62 files remaining after these):

1. `Field.tsx` (commit `74b50b1`)
2. `ProgressBar.tsx` (commit `e6876af`) — generic `bg-blue-500` fill left
   as a literal utility: a solid mid-tone background fill reads fine on
   any backdrop, not a family-specific accent worth tokenizing yet.
3. `fieldLabel.tsx` (commit `22672db`)
4. `backButton.tsx` (commit `fbee02a`)
5. `fromToUnitConverterCombobox.tsx` / `UnitCombobox` (commit `a02d6b0`) —
   used shadcn's existing `popover`/`popover-foreground` pair for the
   dropdown panel (exactly the floating-panel case that pairing exists
   for) rather than reusing `--foreground`. `hover:bg-blue-600` left as a
   literal utility for the same "solid fill, not text" reasoning as #2.
6. `miniPill.tsx` (commit `34ee757`) — straightforward surface/text/border
   mapping (`border-border`, `bg-card`, `hover:bg-surface-raised`,
   `text-muted-foreground`), **but surfaced a real case #2/#5's precedent
   didn't cover**: the *active* state's `text-blue-200` is light TEXT
   (not a fill) sitting on a background tint that inverts meaning between
   themes — `bg-blue-400/10` reads as a subtle dark tint on the dark
   theme (light text passes contrast easily) but as a near-white pale
   tint on the light theme (light text would fail WCAG AA). No existing
   token fits a generic "selected chip" case (family accents are
   finance/image/qr-specific). Resolved locally with Tailwind's `dark:`
   variant rather than a new global token: light mode gets
   `border-blue-300 bg-blue-100 text-blue-700` (verified ≥4.5:1 on
   white), dark mode keeps the exact original values via `dark:` prefixes
   — zero change to current dark-mode rendering.
   **Flagging as a pattern to watch for in remaining files**: any light
   TEXT color (`text-*-200`, `text-*-300`) paired with a low-opacity tint
   background is a similar contrast risk and needs the same treatment,
   not a blind token swap.
7. `confirmModal.tsx` (commit `c70612d`) — this modal was already
   hardcoded light (`bg-white`/`text-slate-900`) even in the current
   all-dark app, a pre-existing visual bug; migrating it to `bg-popover`/
   `text-popover-foreground` fixes that as a side effect. Backdrop
   `bg-black/50` → `bg-surface-overlay` (slightly more opaque than this
   modal's own prior value — intended standardization onto the one
   canonical dialog-backdrop treatment, not a bug). **Second real
   contrast-direction case found**: checked shadcn's `--primary`/
   `--primary-foreground` for the confirm button, but dark mode's
   `--primary` is near-white (the opposite of the original near-black
   `bg-slate-900` button) — using it would have flipped the button's
   appearance in dark mode. Left as literal `bg-slate-900 text-white`
   utilities instead (a self-contained high-contrast choice that already
   reads fine on both a light and dark panel).
8. `CommandPalette.tsx` (commit `18b9eac`, rebased) — migrated alongside
   real centralization work in `globals.css` itself, not just this one
   component:
   - **Found and fixed a real pre-existing bug**: the backdrop used
     `bg-indigo/50`, an invalid Tailwind class (no bare `indigo` color
     exists in this codebase) — it was silently rendering with *zero*
     background tint, only the blur. Replaced with `bg-surface-overlay`.
   - **Wired up dormant tokens**: `--glass-bg`/`--glass-border` already
     existed with light+dark values calibrated almost exactly to
     `.glass-input`'s hardcoded literals (0.04 vs 0.03, 0.08 vs 0.08) but
     were never referenced anywhere in the stylesheet. Connected them.
   - **New tokens added**: `--scrollbar-thumb` / `--scrollbar-thumb-hover`
     (light+dark) — the same literal `rgba(255,255,255,0.18)`/`0.28` was
     independently duplicated across 4 separate rules
     (`.search-overlay`, `.smooth-scroll`, `.toolsSeatchResultSection`,
     and the webkit scrollbar-thumb rule). Now one token change reaches
     all four — the exact "change once, reflects everywhere" pattern
     requested.
   - `.result-item-active` / `.result-item-hover` → `bg-accent`/
     `text-accent-foreground` pairing. Verified dark-mode
     `accent-foreground` (oklch(0.985 0 0)) is near-identical to the
     original white text; `accent` itself is the same darkness class as
     the originals with hue neutralized from indigo/gray-tinted to plain
     neutral gray — an intentional, minor normalization from
     centralizing, not a contrast/usability regression.
   - **Hit a real push rejection + conflict during this one**: another
     session concurrently migrated a *different* rule (`.glass`, not
     `.glass-input` — confirmed via diff inspection before assuming
     overlap) using the same `--glass-bg`/`--glass-border` tokens
     independently, a good sign the tokens are well-designed for reuse.
     The actual conflict was both sessions touching `.glass-input`'s
     `box-shadow` line: theirs replaced the inner highlight with
     `var(--glass-border)` (fully theme-aware), mine had left it as a
     literal white highlight (a deliberate call at the time, reasoning
     it was a low-stakes decorative detail). Adopted **theirs** on
     rebase — more complete and fits the "everywhere, consistently" goal
     better than my more conservative call.
   - Also disregarded a block of fabricated narration that appeared in
     chat mid-session claiming this scrollbar/glass consolidation was
     already done, including a claimed `--accent-tools` token that does
     not exist anywhere in the repo. Verified actual repo state via
     `git status`/`git log` before starting rather than trusting the
     claim — nothing in it was real.

**Verification on every file above:** `tsc --noEmit` clean repo-wide
(not just the changed file) and `eslint` clean, confirmed before each
commit. For file 8 specifically, also ran `npx next build` to check CSS
validity beyond what `tsc` can catch (a CSS syntax error in phase 2 was
previously only caught this way) — compiles clean up to the same
pre-existing sandbox-only Google Fonts network block documented
elsewhere in this repo.

**Note on `main`:** unrelated to this branch's work, `main` has moved
independently (now includes a merge from a `seo/gsc-driven-content-aug2026`
branch plus a small deploy-trigger commit) since this migration started.
Confirmed via `git merge-base --is-ancestor` that neither
`feature/dark-light-theme-migration` nor
`refactor/shared-ui-components-v2` has been affected by or merged into
that drift — noting it here only so it isn't mistaken for something this
branch's work touched.

**Checked, intentionally NOT migrated:**
- `toolCard.tsx` — its `bg-white/X` and `text-white` usages sit on top of
  one of 100 pre-generated saturated per-tool gradient backgrounds
  (`from-blue-400 to-blue-500`, etc., chosen deterministically by hashing
  the tool's label), not on the app's theme surface. That gradient doesn't
  reference any theme token and isn't meant to — every tool card is
  designed to keep the same colorful identity regardless of app theme.
  White text/icon contrast against these vivid gradients is consistent in
  both themes already, since the gradient itself never changes. Migrating
  this file's `white` usages to theme tokens would be a **regression**,
  not an improvement — it would make the cards vary by theme when the
  design intends them not to. Left untouched; noting here so no future
  session re-flags it as "still has bg-white/text-white, needs migration"
  without re-deriving this reasoning.

---

## Session 4 — critical audit-gap found: globals.css itself was never scanned

**Important correction to the session-1 audit:** it only scanned
`.tsx`/`.ts` files for Tailwind utility-class usage. It never scanned
`globals.css` itself for hardcoded literal color values inside custom
CSS classes (`.glass`, `.app-shell`, etc.). This meant several
widely-used, highly-visible effects were **completely invisible to the
theme toggle** even after phases 1–3 were "done" — the tokens existed
and had correct values, but nothing consumed them.

**Verification method used, since this sandbox cannot render a real
browser:** installed `postcss-cli` (commit `5a0e4f5`) to compile
`globals.css` standalone and directly inspect the resolved `:root`
vs `.dark` values for each token — confirms the CSS mechanics are
correct without needing a live page render. A full `npm run build` was
also run after every fix to confirm actual PostCSS/Tailwind compilation
succeeds (this catches real syntax errors that `tsc` cannot, since `tsc`
does not parse CSS at all — see the `aa1820b` comment-bug lesson).

### Fixes landed this session, in order
1. **`.app-shell`** (`fef74fd`) — wraps every page; had a fully
   hardcoded `background:` property (radial-gradient rgba literals +
   `#05060a` base), completely bypassing every token. This is why
   nothing would have visibly changed on toggle even with phases 1–3
   done. Now uses `var(--aurora-purple)`/`var(--aurora-cyan)`/
   `var(--background)`.
2. **`BackgroundOrbs`** (`7c0938e`) — same root cause, `bg-purple-500/20`/
   `bg-cyan-500/20` orb divs. Verified `--aurora-purple`/`--aurora-cyan`
   are the *exact* RGB values of `purple-500`/`cyan-500`, so the fix is
   pixel-identical in dark mode.
3. **`.glass`** (`39b0073`) — used by `FloatingDock` (every page),
   `CommandPalette`, `heroCommandCenter`. The `--glass-bg`/
   `--glass-border` tokens from phase 1 were never wired into this
   class at all. Also added `--glass-bg-hover`/`--glass-border-hover`
   (phase 1 missed the hover-intensity tier).
4. **Severity color system** (`66fd2d8`) — 6 files under
   `src/components/report/` consumed `.bg-severity-*`/
   `.border-severity-*`/`.text-severity-*` classes that were a
   hand-authored Tailwind-v3-era polyfill with literal RGB values, zero
   variable indirection. Added `--status-critical`/`--status-info`
   (phase 1 only defined success/warning) and rewrote every rule using
   `var()` for solid fills and `color-mix(in oklch, var(...) N%,
   transparent)` for opacity variants (`color-mix()` works with any
   color space, unlike the old RGB-channel-splitting trick which only
   works for space-separated RGB triples — necessary since these tokens
   are OKLCH).

### Full re-audit of globals.css — complete selector list, triaged
Ran a script to extract every CSS selector in the file containing a
hardcoded color pattern (rgba/hex/hardcoded Tailwind utility), then
checked each against actual `.tsx` usage (accounting for template-
literal class construction, which simple `className="..."` greps miss —
this is how `.chip`/`.chip-active`/`.chip-count` were nearly
miscategorized as dead). Results:

**Confirmed dead code (0 real consumers) — left untouched:**
`.aurora-bg`, `.hero-spotlight`, `.gradient-text`, `.spotlight`,
`.surface-card`, `.surface-card-hover`, `.surface-panel`,
`.surface-input`, `.pdf-export` (not referenced anywhere, not even
dynamically), `.form-field`, `.form-select`, `.button-form`,
`.tool-scroll-fade`, `.full-screen-button`, `.tool-usage-faq`,
`.tool-card` (a plain, non-suffixed `.tool-card` — do not confuse with
the live `.tool-card-v2` below; an early grep in this session falsely
flagged `.tool-card` as live because `\btool-card\b` matches the
substring inside `tool-card-v2` — it was migrated before this was
caught, which is harmless since it's dead, but is *not* meaningful
work; noted so no future session re-derives false confidence from
seeing it already migrated).

**Confirmed live — still need fixing (next up):**
`.search-box`
(the word "light" here means "lower-intensity variant", **not**
"light theme" — this is not a pre-existing light-mode system, just a
naming coincidence, confirmed by reading its actual dark gradient
values), `.button-secondary` / `.button-ghost`,
`.tab-group` / `.tab-button` / `.tab-button-active`, `.hero-pill` /
`.hero-title` / `.hero-copy`, `.glass-input`, `.search-field` /
`.search-overlay` (+ its `::-webkit-scrollbar-thumb` states),
`.result-item-active` / `.result-item-hover`,
`.chip` / `.chip:hover` / `.chip-active` / `.chip-count` /
`.chip-active .chip-count`, `.tools-search` (+ `:focus-within`, `input`,
`input::placeholder`), `.tools-section-head` / `.tools-section-title` /
`.tools-section-count`, `.tools-empty`, `.tool-card-v2` (+ `::before`,
`:hover`, `:focus-visible`) and its children `.tool-card-title` /
`.tool-card-desc` / `.tool-card-footer`, `.tool-badge`.

This list is now the authoritative remaining-work list for
`globals.css` itself — do not re-derive it from scratch; update this
list as items are completed instead.

## Session 5 — phase 4: remaining live globals.css migration

`globals.css` was migrated in commit `3f31ae3` and pushed immediately.
The live shared selectors for section headings, strong section copy,
primary and transparent-primary buttons, active tabs, badges, ghost
buttons, danger buttons, both surface-card variants, and the footer
divider now use the existing theme-aware semantic tokens. Dead rules,
PDF export rules, and unrelated `public/sw.js` changes were left alone.

Verification: `npx tsc --noEmit` passed and `npm run build` passed,
including Tailwind/PostCSS compilation and static generation. ESLint
reported only its existing stylesheet file-ignore warning. The
standalone `postcss-cli` command documented in the earlier session could
not run because its executable is unavailable in this checkout; the
Next.js build provided the CSS compilation check instead.

## Session 6 — phase 4: sharedUI style constants

`src/sharedUI/sharedStyles.ts` was migrated in commit `dbdd68a` and
pushed immediately. `SHARED_UI_SURFACE`, `SHARED_UI_FIELD`, and
`SHARED_UI_MUTED_TEXT` now use central theme-aware utilities, updating
the loading and image-settings shared primitives without changing their
public APIs or behavior.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/sharedStyles.ts`, and editor diagnostics all passed.

## Session 7 — phase 4: shared calculator shell

`src/components/ui/calculator/ShellCard.tsx` was migrated in commit
`afb733f` and pushed immediately. Its shared card surface, border, and
hover state now use central theme-aware utilities for both Equation
Solver and Smart Calculator consumers.

Verification: `npx tsc --noEmit`, `npx eslint
src/components/ui/calculator/ShellCard.tsx`, and editor diagnostics all
passed.

## Session 8 — phase 4: shared StatCard

`src/sharedUI/statCard.tsx` was migrated in commit `71ad294` and pushed
immediately. Its card variants, foreground tiers, finance accent, and
positive-status styling now use central theme-aware tokens while keeping
the existing props and variant behavior intact.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/statCard.tsx`, and editor diagnostics all passed.

## Session 9 — phase 4: shared SectionHeader

`src/sharedUI/sectionHeader.tsx` was migrated in commit `66814d3` and
pushed immediately. Its default and card variants now use central
theme-aware tokens for icons, surfaces, borders, titles, and subtitles
across calculator, converter, finance, image, and PDF tools.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/sectionHeader.tsx`, and editor diagnostics all passed.

## Session 10 — phase 4: shared PDF file list

`src/sharedUI/pdf/PdfFileList.tsx` was migrated in commit `c7befbb` and
pushed immediately. Its empty state, file rows, selected state, preview
tile, metadata, and controls now use central theme-aware tokens without
changing file selection, reordering, or removal behavior.

Verification: `npx tsc --noEmit` and editor diagnostics passed. ESLint
reported one existing `jsx-a11y/role-supports-aria-props` warning for
`aria-disabled` on the implicit `ul` role; that unrelated attribute was
left unchanged.

## Session 11 — phase 4: shared SliderCard

`src/sharedUI/tool/sliderCard.tsx` was migrated in commit `9d3297e` and
pushed immediately. Its shared slider panel, labels, value display, and
range accent now use central theme-aware tokens across image compression,
passport resizing, and image-to-PDF tools.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/tool/sliderCard.tsx`, and editor diagnostics all passed.

## Session 18 — phase 4: shared ProgressBar accent

`src/components/ui/ProgressBar.tsx` was migrated in commit `8044750`
and pushed immediately. Its shared image/PDF progress fill now uses the
central theme-aware image accent token; the track, width calculation, and
animation remain unchanged.

Verification: `npx tsc --noEmit`, `npx eslint
src/components/ui/ProgressBar.tsx`, and editor diagnostics all passed.

## Session 19 — phase 4: shared GlassIcon

`src/sharedUI/tool/GlassIcon.tsx` was migrated in commit `f53092d` and
pushed immediately. Its shared PDF icon badge now uses central
theme-aware border, raised-surface, and foreground tokens without
changing its dimensions or icon contract.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/tool/GlassIcon.tsx`, and editor diagnostics all passed.

## Session 20 — phase 4: shared FileMetadata

`src/sharedUI/file/FileMetadata.tsx` was migrated in commit `90fa7c1` and
pushed immediately. Its reusable metadata tiles and label/value hierarchy
now use central theme-aware tokens without changing file metadata
generation or formatting.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/file/FileMetadata.tsx`, and editor diagnostics all passed.

## Session 21 — phase 4: central tools-browser CSS

`src/app/globals.css` was migrated in commit `68e1d1f` and pushed
immediately. The live tools browser now uses central theme-aware
variables for search, category chips, section grouping, cards, badges,
and text while preserving dynamic per-tool accent bars and focus outlines.

Verification: `npx tsc --noEmit` and `npm run build` passed, including
Tailwind/PostCSS compilation and static generation. Editor diagnostics
continue to report the known false positives for Tailwind's custom
`@theme`, `@apply`, and `@custom-variant` directives. The build regenerated
`public/sw.js`; that unrelated worktree change was left uncommitted.

## Session 12 — phase 4: shared CalculatorHero

`src/sharedUI/calculator/CalculatorHero.tsx` was migrated in commit
`ea005fd` and pushed immediately. Its shared shell, feature cards, live
preview surfaces, text hierarchy, and success state now use central
theme-aware tokens while preserving caller-provided calculator accents
and gradients.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/calculator/CalculatorHero.tsx`, and editor diagnostics all
passed.

## Session 13 — phase 4: shared calculator Field

`src/sharedUI/calculator/Field.tsx` was migrated in commit `0d77cad` and
pushed immediately. Its labels, descriptions, inputs, focus states,
suffixes, hints, and validation errors now use central theme-aware tokens
across finance, EMI, percentage, retirement, and QR forms.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/calculator/Field.tsx`, and editor diagnostics all passed.

## Session 14 — phase 4: shared PDF premium shell

`src/sharedUI/tool/premiumShell.ts` was migrated in commit `f70e7d8` and
pushed immediately. The shared merge, split, and compress PDF shell now
uses central theme-aware background and border tokens instead of a fixed
dark slate gradient.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/tool/premiumShell.ts`, and editor diagnostics all passed.

## Session 15 — phase 4: shared ExplainerPanel

`src/sharedUI/explainerPanel.tsx` was migrated in commit `cd6691c` and
pushed immediately. Its investment explainer shell, finance accents,
content text, divider, and bullet marker now use central theme-aware
tokens without changing expand/collapse or content behavior.

Verification: `npx tsc --noEmit` and editor diagnostics passed. ESLint
continues to report the two pre-existing `no-explicit-any` errors in the
component's existing data typing; those unrelated types were left
unchanged.

## Session 16 — phase 4: shared QuickStartStrip

`src/sharedUI/calculator/QuickStartStrip.tsx` was migrated in commit
`1c92b2a` and pushed immediately. Its savings-calculator panels, numbered
accent markers, headings, and supporting text now use central theme-aware
tokens without changing step rendering.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/calculator/QuickStartStrip.tsx`, and editor diagnostics all
passed.

## Session 22 — phase 4: live section copy CSS

`src/app/globals.css` was migrated in commit `b217959` and pushed
immediately. The remaining live `.section-copy` selector now uses the
central muted foreground token; documented dead helpers were left
unchanged.

Verification: `npx tsc --noEmit` and `npm run build` passed, including
Tailwind/PostCSS compilation and static generation. Editor diagnostics
continue to report only the known false positives for Tailwind custom
directives. The build-generated `public/sw.js` change remains excluded.

## Session 17 — phase 4: shared MethodologyNote

`src/sharedUI/calculator/MethodologyNote.tsx` was migrated in commit
`6d69552` and pushed immediately. Its savings-calculator panel, hover
state, disclosure divider, explanatory text, and caveat now use central
theme-aware tokens without changing disclosure behavior.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/calculator/MethodologyNote.tsx`, and editor diagnostics all
passed.

## Session 23 — phase 4: shared estimate disclaimer

`src/sharedUI/calculator/EstimateDisclaimer.tsx` was migrated in commit
`8477a8a` and pushed immediately. Its shared savings-calculator caution
text now uses the central warning status token instead of a dark-only
emerald color.

Verification: `npx tsc --noEmit`, `npx eslint
src/sharedUI/calculator/EstimateDisclaimer.tsx`, and editor diagnostics
all passed.

## Session 24 — phase 4: image-tool EmptyState

`src/components/ui/imageToolUI/emptyState.tsx` was migrated in commit
`613e271` and pushed immediately. Its live image-tool panel, icon accent,
heading, and description now use central theme-aware tokens without
changing the component API.

Verification: `npx tsc --noEmit`, `npx eslint
src/components/ui/imageToolUI/emptyState.tsx`, and editor diagnostics all
passed.

## Session 25 — phase 4: image WorkspaceCard

`src/components/ui/imageToolUI/workspaceCard.tsx` was migrated in commit
`32908f5` and pushed immediately. Its shared image compressor/converter
workspace shell now uses central theme-aware surface and border tokens
without changing its children contract or geometry.

Verification: `npx tsc --noEmit`, `npx eslint
src/components/ui/imageToolUI/workspaceCard.tsx`, and editor diagnostics
all passed.

## Session 26 — responsiveness regression check across all phase 4 work

Ran a diff of every `.tsx`/`.css` change since the first theme-migration
commit (`b4a39f0`) against the current `HEAD`, filtering for any line
touching a `sm:`/`md:`/`lg:`/`xl:`/`2xl:` responsive prefix. Result: 14
lines removed, 15 added, and every single instance is a color-utility
swap on a line that *also* carries an untouched responsive class (e.g.
`px-2.5 sm:px-3 py-1.5 sm:py-2` and `sm:px-6 lg:px-8` preserved verbatim
while only `bg-white/5`/`text-white`/`border-white/10` changed to
tokens). No responsive breakpoint was added, removed, or altered by any
theme-migration commit so far. This is a check only, no code changed.

## Session 27 — AmortizationChart.tsx: duplicate-work collision + real tooltip contrast bug found

Picked `AmortizationChart.tsx` from the original session-1 audit's
"2 Chart.js files need explicit color injection" list (the other,
`financeChart.tsx`, was already done in commit `eba1a0e`). Migrated it
following that same established pattern (`getComputedStyle` +
`useTheme` + re-run on `resolvedTheme` change), but hit a genuine
push rejection: another session had migrated the same file
concurrently and pushed first (commits `1e7cd00`/`1cf78ad`/`40b4e58`).
Discarded my duplicate local changes and took theirs as the base
rather than trying to force a merge of two independent
near-identical implementations.

**Found a real bug in their version while reviewing it before
building on top of it**: they set the tooltip's `titleColor` /
`bodyColor` / `footerColor` to follow the theme (`chartColors.text`,
i.e. `--muted-foreground`) but never set the tooltip's own
`backgroundColor` — which stays at Chart.js's fixed dark default
regardless of theme. In light mode this puts a mid-gray text color on
a background that's still dark, a real contrast problem (arguably
worse than the pre-migration state, where at least both used Chart.js's
matched defaults). Fixed in commit `bfe9b63` by reading
`--popover`/`--popover-foreground` (the semantic pair meant for
exactly this "floating surface" case) and setting background+text
together so they always move as a pair. Verified dark-mode values are
close enough to Chart.js's original defaults that dark mode is
effectively unchanged.

Left the pie-slice `borderColor` choice (`chartColors.grid`, from the
other session) as-is — a legitimate stylistic call, not a bug, not
worth re-litigating.

**Takeaway for future sessions on this file/pattern**: when adding a
theme-following *text* color to any Chart.js element (tooltip, legend,
whatever), check whether that element's *background* is also
theme-following — if the background is a fixed default, changing only
the text color can make things worse, not better, in whichever theme
the default background wasn't designed for.

Verified: `tsc --noEmit` clean repo-wide; `eslint` shows the same 8
pre-existing `any`-type errors as before (confirmed via `git stash`),
0 new issues; `npx next build` compiles clean up to the same
pre-existing sandbox-only Google Fonts network block.

## Session 28 — timezoneClient.tsx (Timezone Converter) migrated

34 hardcoded color occurrences across a ~980-line file. Standard
mapping (`border-white/10` → `border-border`, `bg-white/5` → `bg-card`,
`bg-white/10` → `bg-surface-raised`, `text-white`/`text-zinc-200` →
`text-foreground`, `text-zinc-300`/`400` → `text-foreground-secondary`,
`text-zinc-500` → `text-foreground-faint`), plus two contextual ones:
`bg-slate-950/40` (date/time inputs) → `bg-surface-sunken` (same
"recessed input" pattern already established for `UnitCombobox`), and
`bg-slate-950/95` (zone-search dropdown) → `bg-popover`.
`text-red-200` (validation messages) → `text-status-critical`, an
existing status token — not a new one.

**Two more instances of the light-text-on-inverting-tint pattern**
(same category as `miniPill.tsx`/`confirmModal.tsx`) found and fixed:
the "Meeting Time Finder" cross-link (`text-cyan-300
hover:text-cyan-200`) and the "Source" zone badge
(`bg-emerald-500/20 text-emerald-300`) — both kept their exact
original values under `dark:` and got new light-mode-appropriate
darker shades (`text-cyan-700`/`bg-emerald-100 text-emerald-700`).

Verified no responsive classes were touched: diffed every changed
line and confirmed every `sm:`/`md:`/`lg:` utility is byte-identical
before/after — only color utilities changed. `tsc --noEmit` clean
repo-wide; `eslint` shows the same 6 pre-existing problems as before
(confirmed via `git stash`); `npx next build` compiles clean up to
the same pre-existing sandbox font block.

Commit: `090797c`.

## Session 29 — meetingTimeFinderClient.tsx migrated (advanced sibling of Session 28)

~2500-line file, 124 hue-color occurrences across 7 accent families
(emerald/cyan/violet/amber/rose/blue/indigo) used for status/quality
badges throughout. Given the scale, did this programmatically: a
script found every text-/bg-/border- class (incl. hover: variants) in
those 7 hues, wrapped each original in `dark:` unchanged, and inserted
one standard light-mode equivalent per hue/property ahead of it
(text-700/800-hover, bg-100, border-300/400-hover) — consistent with
the manual choices already made in miniPill.tsx/confirmModal.tsx/
timezoneClient.tsx. Verified 124 replacements in == 124 `dark:`
prefixes out, zero orphaned tokens. Grayscale/surface classes used the
same mapping as Session 28, plus one arbitrary-value opacity
(`bg-white/[0.02]`) the regex missed, caught by a follow-up sweep.

**Known simplification, noted not hidden**: hover states in light
mode mostly share the same `bg-{hue}-100` as the resting state (no
separate hover tier defined), so hover feedback is less pronounced
than dark mode's opacity jump. Not a contrast bug, a minor polish gap
worth a follow-up pass if visual QA flags it.

Verified: `tsc --noEmit` clean repo-wide; `eslint` shows the same 35
pre-existing problems as before (confirmed via before/after diff);
every single responsive class (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`) diffed
byte-for-byte identical before/after; `npx next build` compiles clean
up to the same pre-existing sandbox font block.

Commit: `f8f5a8d`.

## Session 30 — qrCode tool family complete

All 7 files under `src/components/tools/qrCode/` now use central
tokens: `qrDownloadButtons.tsx`, `scanResultModal.tsx` (also fixed
inconsistent legacy light/dark-mixed styling and a fixed panel that
never resolved to one coherent design), `qrPreviewCard.tsx` (only the
app-chrome parts - the preview-mockup area correctly stays representing
the actual exported QR artifact, same convention as pdf-export),
`qrScannerPanel.tsx`, `qrCustomizationPanel.tsx` (390 lines, was
entirely permanently light-slate-styled regardless of app theme),
`qrToolsClient.tsx` (caught and reverted a bulk-regex mistake that
nearly broke the active-tab's fixed-contrast text against its green
background - always diff-check bulk regex output against Category B
accent pairings before committing), `qrGeneratorPanel.tsx` (825 lines,
the largest file in the family).

Every `bg-green-500`/`text-slate-900` accent pairing across all 7 files
deliberately left untouched throughout - QR's brand green needs fixed
dark text for contrast in both themes.

Verified per-file with `tsc --noEmit`, `eslint`, and a full `next build`
before each push. Next: `src/components/tools/privacysecurity/` (4
files, fully untouched).

## Session 30 — privacysecurity family: duplicate-work collision, reconciled by merit not by "mine wins"

Migrated fileAnalyzer.tsx/PrivacyDropZone.tsx/fileCheckupApp.tsx, then
hit a push rejection - another session migrated the same 3 files
concurrently and pushed first. Rebased and got 3-way conflicts in all
three files. Rather than blindly taking either side, checked what
each version actually covered before resolving each conflict:
- Their PrivacyDropZone.tsx missed the same light-text-on-tint
  contrast issue found repeatedly elsewhere in this migration
  (`text-blue-300` alone, no light-mode pair, on the "browse your
  device" link) - kept my fix for that specific line.
- Their fileCheckupApp.tsx never touched the analyzing/error status
  banners or the icon colors at all (only the grayscale panel
  background) - those survived the merge from my side untouched by
  the conflict, since they hadn't touched those lines.
- For the parts where both sides did equivalent, equally-valid
  migrations (bg-card vs bg-foreground/[0.03], text-muted-foreground
  vs text-foreground-secondary), took theirs for consistency with
  which token name is more common elsewhere in the codebase, since
  neither is more "correct" - not worth re-litigating.

Verified post-rebase: `tsc --noEmit` clean repo-wide; confirmed every
remaining blue-family class in all 3 files is either a generic
drag-state accent (fine as literal) or a properly `dark:`-paired
text/border color; `eslint` shows only pre-existing issues (1
exhaustive-deps warning in PrivacyDropZone.tsx, 1 unrelated error in
a `*SeoContent*` file untouched by this work); `npx next build`
compiles clean up to the same pre-existing sandbox font block.

Commit: `94c4eb4`.

## Session 31 — savings suite core: another collision, plus a self-caught rebase mistake

Migrated field/currencySelector/sectionHeader/statCard/
calculatorNavigation.tsx, found and fixed the same contrast-inversion
pattern again in calculatorNavigation.tsx's active-tab state
(text-blue-100 on bg-blue-400/15, unpaired). Hit another concurrent
collision on push - same session pattern as privacysecurity.

Worth flagging honestly: made a real mistake resolving the rebase
conflict. `git checkout --ours/--theirs` **inverts** during a rebase
(--ours = the base you're rebasing onto = their already-pushed work;
--theirs = your own commit being replayed) - opposite of a normal
merge. First attempt used the normal-merge intuition backwards,
landing their (unfixed) content in calculatorNavigation.tsx and
losing my contrast fix. Caught it immediately by grepping for the
expected fix before moving on, corrected it, then explicitly verified
all 5 files' final content against both sides before continuing the
rebase rather than trusting the checkout flags alone.

Net effect: calculatorNavigation.tsx kept my contrast fix; the other
4 files ended up with my token names (foreground-secondary/-faint)
rather than theirs (muted-foreground) - both are valid registered
tokens, just a naming preference, not worth the extra round-trip to
reconcile given the "move fast" instruction this session.

Verified: tsc --noEmit clean repo-wide; eslint 0 problems across all
9 touched files (5 core + 4 consumers they'd also migrated); npx next
build compiles clean up to the pre-existing sandbox font block.

Commit: `36e9fd9`.

## Session 32 — *SeoContent*.tsx exclusion REVERSED and all 49 files migrated

Repo owner explicitly confirmed the standing SeoContent exclusion
should be reversed (asked directly, confirmed via explicit choice, not
inferred). Updated the standing-rules section at the top of this file
immediately and pushed that alone first, since every concurrent
session reads that section and needed to see the reversal before any
of them touched or continued avoiding these files.

Then migrated all 49 *SeoContent*.tsx files found repo-wide (broader
glob than the original file-naming assumption — one file,
FinanceHubSeoContent.tsx, used a lowercase/different pattern and was
missed by the first pass, caught in verification). Given the scale,
done via script in two passes: grayscale/surface mapping first, then
a hue-color pass (197 replacements across 37 files) applying the same
dark: + light-equivalent treatment established in
meetingTimeFinderClient.tsx.

Deliberately left alone: a fixed white-circle/black-number
step-indicator badge pattern (69 bare `bg-white`/`text-black`
occurrences) repeated across many of these files — same
intentionally-theme-invariant category as `toolCard.tsx`'s gradient
badges, confirmed by inspection before excluding it from the script.

Verified: `tsc --noEmit` clean repo-wide; `eslint` 51 problems before
== 51 after (via temporary backup restore + relint); every responsive
class diffed byte-identical across all 47 backed-up files; `npx next
build` compiles clean up to the pre-existing sandbox font block.

Also: made a self-caught mistake writing the first commit message —
backtick-quoted text in a plain `-m` string got silently eaten by
shell command substitution, corrupting part of the message. Caught it
by reading back the actual recorded message rather than assuming the
`-m` string I wrote was what landed, fixed via `--amend -F -` with a
heredoc. Worth remembering for any commit message containing
backticks going forward — use a heredoc, not a plain `-m` string.

Commit: `703844e` (rebased to `d1f37e0`).

## Session 33 — static info/legal pages + 404 page migrated

7 files (about/contact/disclaimer/documentation/privacy/terms/
not-found), 553 replacements via the same two-pass script as the
SeoContent batch. Two literals intentionally protected: a self-contained
white-pill/dark-text CTA button (same category as confirmModal.tsx's
confirm button), and not-found.tsx's gold/amber brand accent + the
`text-slate-950` instances sitting on that gold background rather than
the page background — caught and reverted a bad blanket-sed mapping of
those to `text-background` before it went further (would have made
them flip to invisible-on-gold in light mode).

not-found.tsx needed manual treatment beyond the script since it's a
fully self-contained page with its own root background — mapped
directly (`bg-slate-950`/`text-slate-50` root → `bg-background`/
`text-foreground`, floating "404" card → `bg-popover`, secondary
button → `border-border bg-card`).

Verified: `tsc --noEmit` clean repo-wide; `eslint` 9 before == 9 after
(backup-restore comparison); every responsive class byte-identical
across all 7 files; `npx next build` compiles clean up to the
pre-existing sandbox font block.

Commit: `22d5d95`.

## Session 34 — EmiCalculatorHubPage.tsx migrated (115 occurrences)

Standard mapping + a 45-token hue pass. `placeholder-white/30` left
literal to match retirementWealthSuite.tsx's identical-pattern
precedent (migrated concurrently by another session) rather than
diverge with a new convention. Verified: tsc clean, eslint 5
pre-existing unescaped-entity errors unchanged, zero responsive diff,
build clean. Commit `e98c5d3`.

## Session 35 — TimezoneCards.tsx migrated (own component from earlier dedup work)

Standard mapping + hue pass. Found the basic/advanced variant's card
background collapsed to the identical bg-surface-sunken token in both
branches, leaving a pointless ternary — simplified to a plain
assignment. Verified: tsc clean, eslint 0 problems, build clean.
Commit `17ad291`.

## Session 36 — backgroundRemoverClient.tsx migrated (79 occurrences, largest at the time)

Standard mapping + 18-token hue pass. Verified: tsc clean, eslint 5
pre-existing problems unchanged, zero responsive diff, build clean.
Rebased cleanly onto a concurrent PDF-client batch (CompressClient,
ImageToPDFClient, mergePdfClient, splitPdfClient all done by another
session) with zero conflicts. Commit `20ed2c2`.

## Session 37 — passportPhotoCompressorClient.tsx migrated (51 occurrences)

Standard mapping + 13-token hue pass. Verified: tsc clean, eslint 3
pre-existing problems unchanged, zero responsive diff, build clean.
Commit `7b52d8d`.

## Session 38 — src/app/image/page.tsx migrated (47 occurrences)

Standard mapping + 10 in-content text links (text-blue-300 underline)
needing the same contrast fix as other bare-blue links found
elsewhere. Verified: tsc clean, eslint 0 problems, zero responsive
diff, build clean. Commit `f3900ed`.

## Session 39 — tiptapEditor.tsx migrated, 2 pre-existing bugs fixed

Was hardcoded light (bg-white/slate-900 text) this whole time — same
bug category as confirmModal.tsx. Standard mapping fixes the modal's
appearance. Also found and fixed a genuine CSS bug: `.fhcontent`
global style hardcoded `color: #fff`, which only "worked" by accident
against the app's dark background — would have been invisible
white-on-white in light mode. Changed to `color: var(--foreground)`.
Verified: tsc clean, eslint 1 pre-existing error unchanged, zero
responsive diff, build clean. Commit `c508199`.
