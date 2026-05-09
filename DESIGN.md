---
name: Bulbul
description: RAW image culling tool for bird photographers
colors:
  deep-gorge-blue: "#1E3A5F"
  clear-sky-blue: "#4A90E2"
  gorge-hover: "#264A78"
  gorge-active: "#152D4A"
  sky-hover: "#5FA0F0"
  sky-active: "#3B7FD6"
  gorge-light: "#E4ECF5"
  sky-light: "rgba(74,144,226,0.15)"
  fog-white: "#F5F5F7"
  slate-mist: "#6E6E73"
  ash-whisper: "#AEAEB2"
  ink-black: "#1D1D1F"
  paper: "#FFFFFF"
  parchment: "#E8E8ED"
  charcoal-depth: "#1C1C1E"
  shadow-stone: "#2C2C2E"
  border-silver: "#D2D2D7"
  border-dusk: "#38383A"
  forest-calm: "#2E7D4F"
  forest-light: "#E0F0E5"
  canopy-bright: "#5CB870"
  amber-hollow: "#A67B1A"
  amber-light: "#F5ECD4"
  sunbeam: "#E0A830"
  ember-low: "#B33B3B"
  ember-light: "#F5DEDE"
  ember-glow: "#E05A5A"
  panel-frost: "rgba(255,255,255,0.88)"
  panel-frost-dark: "rgba(28,28,30,0.90)"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1.3
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "14px"
  pill: "999px"
spacing:
  xs: "3px"
  sm: "6px"
  md: "12px"
  lg: "18px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.deep-gorge-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    size: md
  button-primary-hover:
    backgroundColor: "{colors.gorge-hover}"
    textColor: "#FFFFFF"
  button-primary-active:
    backgroundColor: "{colors.gorge-active}"
    textColor: "#FFFFFF"
  button-secondary:
    backgroundColor: "{colors.fog-white}"
    textColor: "{colors.ink-black}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-secondary-hover:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink-black}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.deep-gorge-blue}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.gorge-light}"
    textColor: "{colors.gorge-hover}"
  badge-primary:
    backgroundColor: "{colors.deep-gorge-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-success:
    backgroundColor: "{colors.forest-calm}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "{colors.amber-hollow}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
  toggle-on:
    backgroundColor: "{colors.deep-gorge-blue}"
    textColor: "#FFFFFF"
    rounded: "12px"
    height: "24px"
    width: "44px"
  toggle-off:
    backgroundColor: "{colors.border-silver}"
    rounded: "12px"
    height: "24px"
    width: "44px"
  panel-frosted:
    backgroundColor: "{colors.panel-frost}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  nav-bar:
    backgroundColor: "{colors.panel-frost}"
    height: "48px"
    padding: "0 16px"
---

# Design System: Bulbul

## 1. Overview

**Creative North Star: "The Curator's Light Table"**

A light table where a curator spreads out contact sheets, grouped by instinct, assessed in a single glance. The surface is warm but precise: photos command the space, tools recede until summoned, and every mark on the table has intent. The room is quiet, well-lit, and free of clutter. Nothing distracts from the act of seeing and choosing.

Bulbul's design system serves the single task of rapid photo culling. The canvas dominates; chrome recedes. Frosted panels float over the image field, admitting just enough visual context to keep the user oriented without pulling attention from the photographs. The palette borrows from deep gorges and clear skies: a muted blue family that reads as professional without feeling cold, warm without being decorative. Every component is built for immediate legibility: a star rating is understood in 200ms, a selected thumbnail needs no label, a toggle needs no explanation.

The system explicitly rejects the visual language of Adobe Lightroom (heavy chrome, nested panels, feature density as dominance), Google Photos (consumer-grade simplicity that sacrifices precision), traditional file managers (utilitarian grids with no design intention), and SaaS dashboards (metric cards, gradient decorations, progress rings). Bulbul is a tool for experts who value their time. The interface earns trust by staying out of the way.

**Key Characteristics:**
- Canvas-first: the image field occupies maximum area; all UI is secondary or overlay
- Frosted panels: backdrop-blur navigation and filmstrip float over content, never displace it
- Tinted neutrals: no pure black or white; every surface carries a faint blue undertone
- Immediate feedback: every interaction responds in 120ms or less; no loading choreography
- Restrained color: one blue family carries the system; semantic colors appear only in their functional roles

## 2. Colors

The palette is organized around a single blue family that shifts character between light and dark modes. In light mode, Deep Gorge Blue grounds the interface with the weight of shadowed water; in dark mode, Clear Sky Blue lifts the same identity into luminous relief. Neutral surfaces carry a faint cool tint that unifies them with the primary family without being obviously blue.

### Primary

- **Deep Gorge Blue** (#1E3A5F): The core identity color. Used for primary buttons, active states, selected indicators, and focus rings in light mode. Carries authority without aggression; reads as professional depth.
- **Clear Sky Blue** (#4A90E2): The dark-mode counterpart of Deep Gorge Blue. Replaces it as the primary accent when the background shifts to dark. Used identically: primary actions, active states, selections. Brighter to maintain contrast against dark surfaces.
- **Gorge Hover** (#264A78) / **Sky Hover** (#5FA0F0): Interactive feedback for primary actions. One step lighter than the base primary.
- **Gorge Active** (#152D4A) / **Sky Active** (#3B7FD6): Pressed state for primary actions. One step darker than the base primary.
- **Gorge Light** (#E4ECF5) / **Sky Light** (rgba(74,144,226,0.15)): Tinted background for selected rows, ghost button hover, and subtle emphasis zones. The light-mode variant is opaque and clearly blue-tinted; the dark-mode variant uses alpha transparency for the same effect.

### Neutral

- **Paper** (#FFFFFF) / **Ink Black** (#1D1D1F): Surface and text extremes. Neither is pure: Ink Black carries a barely perceptible cool cast, Paper is technically white but always adjacent to tinted surfaces.
- **Fog White** (#F5F5F7): Secondary surface. Sidebar backgrounds, setting panels, grouped cards. The faint blue undertone becomes visible when placed next to Paper.
- **Parchment** (#E8E8ED): Tertiary surface and light borders. Hover states on secondary buttons, divider backgrounds, inactive track fills.
- **Slate Mist** (#6E6E73): Secondary text. Descriptions, metadata labels, de-emphasized content.
- **Ash Whisper** (#AEAEB2): Muted text and scrollbar thumbs. The lowest-contrast text role; never used for interactive elements.
- **Charcoal Depth** (#1C1C1E) / **Shadow Stone** (#2C2C2E): Dark-mode secondary and tertiary surfaces. Warmer than they appear; the context of pure-black backgrounds makes them read as elevated.
- **Border Silver** (#D2D2D7) / **Border Dusk** (#38383A): Structural borders in light and dark modes respectively. Used on inputs, card edges, and separators.

### Semantic

- **Forest Calm** (#2E7D4F) / **Canopy Bright** (#5CB870): Success states. Check marks, completed indicators, copy-confirmations. The green is muted, not vivid; it signals completion without celebration.
- **Amber Hollow** (#A67B1A) / **Sunbeam** (#E0A830): Warning states. Caution indicators, partial-progress markers. Warm amber that reads as attention, not alarm.
- **Ember Low** (#B33B3B) / **Ember Glow** (#E05A5A): Danger and error states. Delete-confirm buttons, error toasts. Saturated enough to be unmissable, controlled enough not to feel aggressive.

### Named Rules

**The One Family Rule.** The entire chromatic identity is carried by one blue family. No secondary accent, no complementary color, no decorative palette. Semantic colors appear only in their functional roles (success, warning, danger); they are never used decoratively. The blue family is the only color that can appear on an otherwise neutral surface without being tied to a specific semantic function.

**The Frost Rule.** Panels that overlay the image canvas use frosted glass (backdrop-filter: blur(12px)) with semi-transparent backgrounds. The frost lets the image show through just enough to maintain spatial orientation while keeping the panel content legible. Opaque panels over the canvas are prohibited.

## 3. Typography

**Body Font:** System font stack (-apple-system, BlinkMacSystemFont, Segoe UI, PingFang SC, Microsoft YaHei, sans-serif)
**No display font.** A single well-tuned sans carries every role: headings, body, labels, data, and UI controls.

**Character:** The typeface is invisible by design. It borrows the user's platform native, so it feels like it belongs on their machine from the first launch. No personality to notice, no quirks to overcome. The hierarchy does the work; the font stays out of the way.

### Hierarchy

- **Display** (semibold 600, 28px, 1.3): Dialog titles and hero headings. Rare in a culling tool; appears only in About and onboarding.
- **Headline** (semibold 600, 24px, 1.3): Section headers in settings panels. Group titles within the settings drawer.
- **Title** (semibold 600, 20px, 1.3): Subsection headers. Rare; the app's information density favors compact labels over hierarchical headings.
- **Body** (normal 400, 15px, 1.6): Prose content, descriptions, and general reading text. Max line length 65ch where applicable. This is also the root font size.
- **Label** (medium 500, 13px, 1.4): UI controls, setting row labels, button text, filmstrip metadata. The workhorse size for interactive surfaces. Tabular-nums variant for numeric values (file counts, percentages, dimensions).
- **Caption** (semibold 600, 11px, 1.4): Badges, star ratings, tiny indicators, progress percentages. Always semibold to maintain legibility at small sizes.

### Named Rules

**The Compact Scale Rule.** The type scale ratio is 1.15-1.2 between steps, not 1.25+. Product UI favors density over dramatic contrast. A 28px heading next to a 13px label creates enough hierarchy; exaggerating the gap would waste vertical space without improving comprehension.

**The Tabular Numbers Rule.** Any numeric value displayed in a data context (file counts, percentages, focal lengths, ISO values) uses font-variant-numeric: tabular-nums. Numbers that shift width on update are a failure of precision.

## 4. Elevation

Bulbul uses a hybrid elevation model: tonal layering for structural hierarchy, and shadows for interactive state feedback. No surface casts a shadow at rest purely to signal its rank; shadows appear only as responses to user action.

The frosted glass panels (TopNavBar, BottomFilmstrip) are the primary elevation mechanism. Their backdrop-filter blur plus semi-transparent background creates a clear visual separation from the canvas below without the weight of an opaque panel or the artificiality of a drop shadow.

Settings cards and dialog surfaces use tonal layering: they differ from their parent background by one step on the neutral surface scale (Paper vs. Fog White in light mode, Charcoal Depth vs. Shadow Stone in dark mode).

### Shadow Vocabulary

- **Subtle** (`0 1px 2px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)`): Resting state for primary buttons and badge-primary. Barely perceptible; its absence is more noticeable than its presence.
- **Normal** (`0 2px 4px rgba(0,0,0,0.06), 0 4px 8px rgba(0,0,0,0.1)`): Hover state for primary buttons, resting state for toasts and popovers. Signals "this element can be interacted with."
- **Elevated** (`0 4px 8px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.14)`): Hover state for toasts, resting state for province popovers and dialogs. The highest shadow used in normal interaction.
- **Deep** (`0 8px 16px rgba(0,0,0,0.14), 0 16px 32px rgba(0,0,0,0.18)`): Reserved for critical overlays. Currently unused in production; available for future modal stacking.

Dark mode multiplies shadow opacity by approximately 5x to maintain visibility against dark surfaces. The shadow shapes remain identical; only opacity changes.

### Named Rules

**The Resting-Flat Rule.** Surfaces are flat at rest. Shadows appear only as a response to state: hover, focus, or elevation from a popover. A card sitting in a settings panel has no shadow; a toast hovering over the canvas does.

## 5. Components

Every interactive component is tactile and responsive: hover states brighten surfaces, active presses trigger a scale-down with bounce easing, and focus rings follow the global 2px primary-color outline. Transitions are fast (120ms standard, 200ms for larger state changes). The bounce easing (cubic-bezier(0.34, 1.56, 0.64, 1)) is used sparingly for active press feedback only; all other transitions use the standard ease (cubic-bezier(0.4, 0, 0.2, 1)).

### Buttons

- **Shape:** Tightly rounded (4px radius), no rounded corners as identity. Compact and functional.
- **Primary:** Deep Gorge Blue background, white text, subtle shadow. Padding 8px 16px (md), 6px 12px (sm). Hover brightens to Gorge Hover with shadow upgrade. Active darkens to Gorge Active with shadow return. Active press: scale(0.98) over 80ms with bounce easing.
- **Secondary:** Fog White background, Ink Black text, border-silver border. Hover upgrades to Parchment background with subtle shadow. No decorative borders.
- **Ghost:** Transparent background, Deep Gorge Blue text. Hover fills with Gorge Light. Used for non-critical actions, tool toggles, and inline triggers.
- **Focus-visible:** 2px solid primary outline, offset 1px. Identical across all variants.
- **Disabled:** 50% opacity, not-allowed cursor, no transform on press.

### Tool Buttons

- **Shape:** 32px square, 6px radius. Slightly rounder than action buttons for visual distinction.
- **Default:** Transparent background, Slate Mist icon. Hover: Parchment background, Ink Black icon. Active: scale(0.92), more pronounced than action buttons.
- **Active state:** Gorge Light background, Deep Gorge Blue icon. Indicates a toggle is engaged (e.g., loupe mode, bird detection overlay).

### Badge

- **Shape:** Pill (999px radius). Min-width 20px, height 20px. Always centered text.
- **Primary:** Deep Gorge Blue background, white text, subtle shadow. Used for counts and status indicators on primary surfaces.
- **Success / Warning:** Forest Calm / Amber Hollow background, white text. Used for completion and caution indicators.
- **Default:** Fog White background, Slate Mist text, border-light outline. For non-critical metadata.
- **OnPrimary:** White 25% opacity background, white text. Nested inside primary buttons to add counts (e.g., "Export (3)").

### Toggle

- **Shape:** Pill track (44px x 24px, 12px radius) with circular knob (20px diameter).
- **Off:** Border Silver track, white knob with fine shadow. Dark mode: white 15% opacity track.
- **On:** Deep Gorge Blue track, white knob translated 20px right. Dark mode: Clear Sky Blue track.
- **Transition:** 200ms cubic-bezier(0.4, 0, 0.2, 1) on both background-color and knob transform. No bounce; toggles should feel decisive, not playful.

### Frosted Panels (TopNavBar, BottomFilmstrip)

- **Background:** Panel Frost (rgba 88% white / 90% dark). Backdrop-filter: blur(12px).
- **Border:** Hairline (0.5px) in panel-border color (6% black / 6% white).
- **Shadow:** Panel shadow (0.5px 0 in 5%/30% black) on the edge facing the canvas.
- **Enter animation:** 250ms slide from panel edge (y: -10px for top, y: 20px for bottom) with standard easing.
- **Content:** 16px horizontal padding. TopNavBar is 48px tall. BottomFilmstrip is 72px tall.

### Settings Panel

- **Entry:** 320px wide slide from right. Spring animation (damping 30, stiffness 300).
- **Cards:** 10px radius, Paper background, hairline bottom border. Dark mode: Shadow Stone background, no shadow.
- **Rows:** 44px min-height, 16px horizontal padding. Label (13px normal) on left, value (13px semibold, tabular-nums) on right.
- **Action buttons:** Compact (28px height, 6px radius, 12px font). Five variants: default, primary, danger, confirm-danger, tinted. Each uses color-mix for tinted backgrounds rather than opaque fills.
- **Close:** 28px circle, Parchment background, hover Border Silver.

### Dialogs

- **About Dialog:** 300px wide, 14px radius (the largest radius in the system), fine border, elevated shadow. Spring entrance (scale 0.95 to 1, y: 4px to 0). App icon at 72px with 16px radius.
- **Overlay:** Full-screen, 35% black backdrop.

### Filmstrip Items

- **Shape:** 48px square thumbnail, 4px radius, 1.5px transparent border.
- **Hover:** Parchment background, border shifts to Border Silver.
- **Active (group selected):** Gorge Light background, primary-color border, 2px primary-light focus ring. Bottom indicator bar (20px x 2px, primary color) slides in with 260ms ease-out.
- **Press:** scale(0.96).
- **Count label:** 10px, Ash Whisper. Active: primary color, semibold.

### Toast

- **Shape:** 6px radius, 300-420px width, normal shadow (upgrades to elevated on hover).
- **Icon:** 22px circle in semantic color with white icon.
- **Behavior:** Hover pauses auto-dismiss timer. Close button at 20px with 3px radius.
- **Duration:** Fast (3s for success), slow (5s for error/warning).

## 6. Do's and Don'ts

### Do:

- **Do** use the Deep Gorge Blue (#1E3A5F) / Clear Sky Blue (#4A90E2) family exclusively for primary actions, active states, and selected indicators. Its rarity is its authority.
- **Do** respond to every interaction within 120ms. The transition-fast token (120ms) is the ceiling for hover and focus feedback; 200ms for larger state changes.
- **Do** use frosted glass (backdrop-filter: blur(12px)) for panels that overlay the canvas. The image must remain partially visible through navigation and filmstrip chrome.
- **Do** scale down on active press with bounce easing (cubic-bezier(0.34, 1.56, 0.64, 1)) to create tactile feedback. Buttons: scale(0.98) at 80ms; tool buttons: scale(0.92); filmstrip items: scale(0.96).
- **Do** use tabular-nums for any numeric value that updates in place. Shifting column widths are a precision failure.
- **Do** tint neutral surfaces with a faint cool undertone (the blue family at 8-15% opacity) rather than using pure gray or pure white.
- **Do** respect prefers-reduced-motion: disable all transitions and animations when the user has indicated this preference.

### Don't:

- **Don't** build interfaces that resemble Adobe Lightroom: heavy chrome, nested panel trees, feature density as dominance. Bulbul is a focused culling tool, not a full editing suite.
- **Don't** build interfaces that resemble Google Photos: consumer-grade simplicity that sacrifices professional precision. Bulbul's users need star ratings, focus scores, and EXIF data, not "nice photo" sentiment.
- **Don't** build interfaces that resemble traditional file managers: utilitarian grids with no design intention, no visual hierarchy, no respect for the content. Every surface should feel considered.
- **Don't** build interfaces that resemble SaaS dashboards: metric cards with big numbers, gradient accents, progress rings, or hero-stat templates. Data serves decisions, not decoration.
- **Don't** add shadows to surfaces at rest. Shadows are interactive feedback only. A static card in a settings panel is flat; a hovering toast over the canvas casts a shadow.
- **Don't** use gradient text (background-clip: text with gradients). Use weight or size for emphasis, not color theatrics.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on cards, list items, or alerts. Use background tints or full borders instead.
- **Don't** use glassmorphism decoratively. Frosted panels exist to let the image show through navigation chrome, not to make buttons look trendy.
- **Don't** use pure black (#000000) or pure white (#FFFFFF) as intentional surface colors when they appear alone. Tint every neutral toward the brand hue. The only exception is the dark-mode primary background (#000000), which serves as the canvas-adjacent surface.
