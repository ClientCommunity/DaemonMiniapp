# Component Specifications (/KUI:system)

## 1. Buttons
- **Primary CTA:** Brand Violet gradient (`from-[#7c3aed] to-[#6366f1]`), 44px min-height, 16px horizontal padding, 14px bold text, white foreground, subtle shadow.
- **Secondary CTA:** Surface background, 1px border (`border-slate-300` / `border-[#22232e]`), 44px min-height, hover state with border highlighting.
- **Icon / Theme Toggle:** 44px × 44px touch target, rounded-xl, centered icon, clear hover background.

## 2. Category Filter Chips
- **Container:** Rounded-xl or pill container with 4px inner padding.
- **Chip:** 36px–40px height, 12px font size, 600 weight. Active: Solid `#7c3aed` with white text. Inactive: Muted text with hover background.

## 3. Cards (Service & Bento Grid)
- **Container:** `rounded-2xl`, 1px border. Dark: `bg-[#12131a] border-[#1f202b]`. Light: `bg-white border-slate-200 shadow-sm`.
- **Hover:** Subtle 2px lift or border brightening (`hover:border-[#7c3aed]/50`), transition 200ms ease-out.
- **Selected State:** Ring or brand border highlight (`border-[#7c3aed] ring-2 ring-[#7c3aed]/20`).

## 4. Input Fields
- **Search & Select:** Uniform 44px height, 14px text size, 12px horizontal padding. Focus ring with `#7c3aed` border.
- **Quantity Stepper:** 40px height, centered text, min 1, max 100, font-mono.

## 5. Badges & Tags
- **Success Badge:** Pill or 6px radius, `bg-emerald-500/10`, 11px font-mono, Dark: `text-[#22c55e]`, Light: `text-[#15803d]`.
- **Format Tag:** 4px radius, `bg-slate-100 dark:bg-[#181924]`, 11px font-mono, Dark: `text-[#94a3b8]`, Light: `text-[#475569]`.
- **Speed Tag:** 4px radius, `bg-sky-500/10`, 11px font-mono, Dark: `text-[#38bdf8]`, Light: `text-[#0284c7]`.

## 6. Empty State
- **Illustration/Icon:** 48px muted search or filter icon inside a 64px rounded-2xl container.
- **Heading:** 16px font-bold, primary text.
- **Subtext:** 13px, secondary text, describing why no services matched.
- **Action:** 36px height "Reset Filters" button returning category to "all" and clearing search query.
