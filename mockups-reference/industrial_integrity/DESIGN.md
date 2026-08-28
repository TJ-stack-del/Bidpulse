---
name: Industrial Integrity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  code-sm:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

This design system is engineered for the high-stakes environment of government procurement. The brand personality is **Expert, Compliant, and Streamlined**, prioritizing information density without sacrificing clarity. 

The design style is **Corporate / Modern** with a focus on **Minimalism**. It utilizes a systematic approach to data visualization, ensuring that every pixel serves a functional purpose. The aesthetic avoids unnecessary ornamentation, instead relying on precise alignment, generous whitespace to reduce cognitive load during complex tasks, and a rigid adherence to a structured grid. The goal is to evoke an emotional response of absolute reliability and industrial-grade security.

## Colors

The palette is anchored by **Deep Navy (#0F172A)**, used for primary navigation and high-level headers to establish immediate authority. **Security Blue (#2563EB)** serves as the primary action color, guiding users through the procurement lifecycle with high-contrast interactive elements.

**Success Green (#10B981)** is reserved strictly for compliance markers, approved statuses, and positive completion states. The neutral scale is built on a range of cool grays, providing the structural scaffolding for borders, backgrounds, and secondary text. This color strategy ensures that "Compliance" and "Action" are the most visually distinct elements on any given screen.

## Typography

The typography system uses **Inter** for the primary interface to ensure maximum legibility across all display types. **Geist** is introduced for labels and technical data, leveraging its precise, monospaced-adjacent tracking for serial numbers, CAGE codes, and procurement IDs.

Headlines use tighter letter spacing and heavier weights to project a sense of stability. Body text is optimized for long-form document reading with a 1.5x line-height ratio. For mobile views, large display type scales down significantly to maintain vertical rhythm in data-heavy views.

## Layout & Spacing

This design system employs a **Fixed Grid** model for desktop to ensure complex data tables and multi-column forms remain readable. The layout is built on a 12-column grid with a 1440px maximum container width.

Spacing follows a strict **4px baseline grid**. Components are separated by increments of 8px or 16px to maintain a rhythmic, organized structure. Mobile layouts transition to a single-column fluid flow with 16px side margins. Horizontal padding within data cells is kept tight (12px) to maximize information density while maintaining a clear gutter between data points.

## Elevation & Depth

To maintain a professional and "industrial" feel, the system uses **Low-Contrast Outlines** and **Tonal Layers** rather than heavy shadows. 

- **Surface Levels:** The background uses a subtle off-white (#F8FAFC), while primary containers use a pure white background with a 1px border (#E2E8F0).
- **Interactive Depth:** Elements like cards or buttons do not "lift" with shadows; instead, they use subtle background color shifts (e.g., from white to #F1F5F9) on hover to indicate interactivity.
- **Modals:** Only global modals use an ambient shadow (15% opacity Deep Navy, 32px blur) to provide necessary focus, while all other UI elements remain flat to the surface.

## Shapes

The shape language is **Soft (0.25rem)**, providing just enough radius to feel modern and accessible while maintaining the sharp, precise edges associated with government and legal documents. 

Large containers like dashboard panels use `rounded-lg` (0.5rem) to differentiate the application frame from individual components. Functional elements like input fields, buttons, and checkboxes strictly follow the base 4px radius to ensure a cohesive, "blocked-out" appearance when stacked in complex forms.

## Components

- **Buttons:** Primary buttons use Deep Navy with white text. Action-oriented secondary buttons use Security Blue. All buttons feature a subtle 1px inset border for a "pressed" look when active.
- **Stage Indicators:** The 6-stage lifecycle is represented by a horizontal stepper. Completed stages use Success Green, the active stage uses Security Blue with a pulse-border, and future stages use a light gray outline.
- **Data Tables:** These are the core of the system. Use "Zebra-striping" with a very light tint (#F8FAFC) for row readability. Row height is compact (40px) with 12px horizontal padding.
- **Status Chips:** Small, pill-shaped indicators with low-opacity backgrounds and high-contrast text (e.g., a "Verified" chip has a light green background with Success Green text).
- **Input Fields:** Use a 1px #CBD5E1 border that transitions to Security Blue on focus. Labels are always positioned above the field in Geist Medium for technical clarity.
- **Compliance Cards:** Use a vertical Success Green border-left (4px) to signal that a specific section has passed all validation checks.