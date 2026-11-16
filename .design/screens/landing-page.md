# Screen Specification: Landing Page (/KUI:screen)

## 1. Screen Architecture
The Landing Page serves as the primary storefront and conversion engine for Deamon OTP. It accommodates both high-intent buyers looking to immediately purchase an SMS code or Telegram session via Google Auth, and exploratory users evaluating rates, reliability, and dual-platform Telegram bot synchronization.

### Visual Hierarchy Flow:
1. **First Focal Point:** Hero Headline + Primary Action ("Sign In with Google" and "Explore Live Rates & Stock").
2. **Second Focal Point:** Interactive Live Rates Terminal with real-time app search, category pills, instant rate calculator, and clear pricing in INR / USDT.
3. **Third Focal Point:** Infrastructure Bento Grid (4 backend server pipelines detailing LZT, Vintage Sessions, SMS OTPs, and SMM Panel) + Step-by-Step Order Flow.
4. **Fourth Focal Point:** Trust policies (100% automated refund guarantee, 2FA inclusion), FAQ accordion, and dual bot support links in the footer.

---

## 2. Interactive States & Micro-interactions

| State | Component | Behavior |
|-------|-----------|----------|
| **Loading** | Google Sign-in Card & CTA | Spinning indicator, text changes to "Signing in with Google...", input disabled. |
| **Empty** | Service Rate Terminal | Displays search icon, "No services found", and a 1-click "Clear Filters" button. |
| **Hover** | Service Cards & Bento Cards | Smooth 200ms ease-out border transition and subtle elevation. |
| **Active / Selection** | Service Cards | Highlighted `#7c3aed` border + ring; automatically updates the Rate Estimator Bar. |
| **Theme Toggle** | Header | Smooth transition between light ceramic slate and deep matte architectural dark. |
| **FAQ Accordion** | Support Section | 180° rotation of chevron icon with smooth toggle of answer container. |

---

## 3. Accessibility Checklist (WCAG 2.2 AA)
- [x] All interactive elements have ≥ 44×44pt touch bounding targets.
- [x] Semantic color pairings meet or exceed 4.5:1 contrast against light and dark surfaces.
- [x] Input elements feature distinct focus outlines and descriptive labels.
- [x] Clean keyboard navigation with tab index and accessible ARIA attributes.
