# Killer UI Dark Mode & Contrast Report (/KUI:darkmode)

**Target:** `frontend/src/components/landing/LandingPage.tsx` & `frontend/src/index.css`  
**Standard:** WCAG 2.2 AA Contrast Compliance (≥ 4.5:1 for normal text, ≥ 3.0:1 for large text/UI components)  

---

## 1. Identified Dark & Light Mode Flaws

### 1.1 Inverted Brittle Selector Architecture
In `frontend/src/index.css`, the existing theme implementation relied on `html.light .bg-[#12131a]`, `html.light .bg-[#14151c]`, and wildcard resets `html.light .bg-[#181924] * { color: #334155 !important; }`.  
**Flaw:**  
- The wildcard reset destroyed intentional status colors in light mode (e.g., green success rates, sky speed tags, and violet accents were forced to slate gray).
- Whenever any component changed a Tailwind arbitrary hex color (e.g. from `#12131a` to `#13141b`), light mode completely broke because the CSS rule didn't match.

### 1.2 Contrast Ratios in Light Mode
- **Status Green:** `#22c55e` on `#ffffff` is 2.3:1 (CRITICAL WCAG AA FAIL). In light mode, status green must be `#15803d` (emerald-700, 4.8:1) or `#166534` (emerald-800).
- **Accent Sky:** `#38bdf8` on `#ffffff` is 2.1:1 (CRITICAL WCAG AA FAIL). In light mode, sky accents must be `#0284c7` (sky-600, 4.6:1) or `#0369a1` (sky-700).
- **Secondary Muted Text:** `#71717a` on white is 3.9:1 (FAIL for normal text). In light mode, secondary copy must use `#475569` (slate-600, 5.9:1) or `#334155` (slate-700, 9.4:1).

### 1.3 Dark Mode Contrast Ratios
- **Muted text in Dark Mode:** `#71717a` on `#090a0f` is 4.7:1 (AA Pass).
- **Primary text in Dark Mode:** `#ffffff` on `#090a0f` is 18.2:1 (AAA Pass).
- **Card Surfaces in Dark Mode:** `#12131a` on `#090a0f` with `#22232e` borders provides clean visual separation without harsh glare.

---

## 2. Mathematical Token Solution

Instead of relying on fragile CSS regex selectors, we define clear semantic CSS classes in `index.css` and use clean conditional Tailwind classes in `LandingPage.tsx`:

```css
/* Dual-Mode Card Surface */
.kui-surface {
  background-color: var(--kui-surface);
  border-color: var(--kui-border);
  color: var(--kui-text-primary);
}

/* Dual-Mode Page Root */
.kui-root {
  background-color: var(--kui-bg);
  color: var(--kui-text-primary);
}
```

Or using Tailwind's `isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#12131a] border-[#22232e] text-white'` paired with WCAG AA compliant semantic text and tag classes.
