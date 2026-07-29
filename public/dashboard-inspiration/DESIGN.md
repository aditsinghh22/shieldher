# Design System Specification: Editorial Guardian (Light Mode)

## 1. Overview & Creative North Star
The Creative North Star for this design system is **"The Curated Sanctuary."** 

This is not a generic SaaS interface; it is a premium digital environment that balances the authority of a high-end editorial publication with the protective warmth of a modern wellness sanctuary. We move beyond the "template" look by embracing a layout strategy defined by intentional white space, rhythmic asymmetry, and tonal depth. By utilizing large-scale serif typography and layered "glass" surfaces, we create an experience that feels quiet yet powerful, sophisticated yet profoundly trustworthy.

---

## 2. Colors: The Veridian Shield Palette
The palette is rooted in organic, earthy tones that evoke nature and stability. 

### Core Palette
- **Background (#fdf9f0):** Our primary canvas. A soft cream that is easier on the eyes than pure white, providing an immediate sense of "high-end paper."
- **On-Surface / Primary Text (#1c1c16):** A deep charcoal. Avoid pure black (#000) to maintain the editorial softness.
- **Primary Accent (#466550):** The signature leaf green. Used for moments of action, success, and brand presence.

### The "No-Line" Rule
**Borders are a failure of hierarchy.** 1px solid lines for sectioning are strictly prohibited. Boundaries must be defined through:
1.  **Background Shifts:** Transitioning from `surface` (#fffbff) to `surface-container-low` (#fdf9ed).
2.  **Tonal Transitions:** Using subtle gradients to suggest a change in context.

### Surface Hierarchy & Nesting
Treat the UI as a physical desk of stacked vellum. 
- Use `surface-container-lowest` (#ffffff) for the most prominent foreground cards.
- Use `surface-container` (#f7f4e5) or `surface-dim` (#e6e3cd) for structural backgrounds.
- Elements should "nest" by moving through the container tiers, creating natural depth without the clutter of lines.

### The "Glass & Gradient" Rule
For high-end floating elements (modals, navigation bars, or hover states), utilize **Glassmorphism**:
- **Fill:** Semi-transparent `surface` colors (e.g., #fffbff at 70% opacity).
- **Effect:** `backdrop-blur` (12px to 20px).
- **Soul:** Main CTAs should use a subtle linear gradient from `primary` (#466550) to `primary-dim` (#3b5944) to provide a rich, tactile feel.

---

## 3. Typography: Editorial Authority
The typographic pairing is designed to contrast the traditional "Guardian" feel with modern "UI" efficiency.

- **Headlines (Newsreader):** Use for `display` and `headline` scales. This serif is our voice—sophisticated and trustworthy. Use generous letter-spacing (optical sizing) and tight line-heights (1.1 - 1.2) for a bold, magazine-style impact.
- **UI Elements (Manrope):** Use for `title`, `body`, and `labels`. This geometric sans-serif ensures clinical precision and readability.
- **Hierarchy as Identity:** Establish "The Digital Curator" feel by using a massive scale contrast. A `display-lg` headline (3.5rem) should often sit near a `body-md` (0.875rem) descriptor to create a clear, authoritative focal point.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering** rather than traditional drop shadows.

- **The Layering Principle:** Soft, natural lift is achieved by placing a `surface-container-lowest` card atop a `surface-container-low` section. 
- **Ambient Shadows:** When an element must "float" (e.g., a primary CTA button or a modal), use a highly diffused shadow:
    - **Color:** Tinted with `on-surface` (#39382b) at 5% opacity.
    - **Blur:** 24px - 40px.
    - **Spread:** -4px (to keep it tight and premium).
- **The "Ghost Border" Fallback:** If a boundary is required for accessibility, use the `outline-variant` (#bcbaa7) at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons
- **Primary:** Gradient fill (`primary` to `primary-dim`), white text, `md` (0.375rem) roundedness.
- **Secondary:** Transparent fill with a "Ghost Border" and `on-surface` text.
- **Tertiary:** No background, `label-md` weight, with a subtle `primary` underline on hover.

### Cards & Lists
- **Rule:** Forbid divider lines.
- **Cards:** Use `surface-container-lowest` with a subtle `xl` (0.75rem) corner radius. Use vertical white space (32px - 48px) to separate content blocks within the card.
- **Lists:** Differentiate items through a 2% shift in background color on hover, rather than using lines.

### Input Fields
- **Style:** Subtle `surface-container-high` (#f2eedd) background with a "Ghost Border." 
- **Focus State:** Border shifts to `primary` at 40% opacity with a soft glow effect.

### Glass Navigation
The top navigation bar should always be a glassmorphic layer (`surface` at 80% with blur), allowing the "Veridian" content to peak through as the user scrolls, maintaining the "Editorial Guardian" presence at all times.

---

## 6. Do's and Don'ts

### Do
- **Do** use asymmetrical layouts. For example, a headline that is left-aligned with a descriptive body paragraph pushed to a 60% offset.
- **Do** utilize "Breathing Room." If you think there is enough white space, add 16px more.
- **Do** use `primary` (#466550) sparingly. It is a status and action indicator; don't drown the "Curated Sanctuary" in green.

### Don't
- **Don't** use 1px solid borders to separate sections.
- **Don't** use high-contrast, dark grey shadows.
- **Don't** use Manrope for large display headlines; it loses the "Editorial" character.
- **Don't** use standard 12-column grids religiously. Break the grid with overlapping images or offset text blocks to create visual interest.