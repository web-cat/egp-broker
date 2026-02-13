# CSS Analysis: app/pages/index.vue (Tailwind CSS)

This document breaks down the Tailwind CSS utility classes used in the main landing page. These classes enable rapid, responsive, and consistent styling directly within the HTML/Vue template.

## Layout & Positioning

- **Display**: 
  - `grid`, `inline-flex`, `flex`: Core layout modes for alignment.
  - `grid-cols-1`, `md:grid-cols-2`, `lg:grid-cols-4`, `xl:grid-cols-3`: Defines responsive column layouts for the grid.
  - `lg:col-span-1`, `lg:col-span-3`: Spans components across grid columns on larger screens.
- **Box Model**:
  - `min-h-screen`: Ensures the page takes up at least the full height of the viewport.
  - `h-[400px]`: Sets a fixed height for the scrollable container.
  - `max-w-md`, `mx-auto`: Constrains width and centers elements horizontally.
- **Alignment**:
  - `items-center`, `justify-center`, `justify-between`: Aligning children inside flexbox containers.
  - `text-center`: Center aligning text content.
- **Overflow**:
  - `overflow-hidden`: Prevents children from spilling out of rounded corners.
  - `overflow-y-auto`: Adds a vertical scrollbar when content exceeds fixed heights.

## Spacing

- **Padding (Inside)**:
  - `py-12`, `py-16`, `p-2`, `p-3`, `p-4`, `p-6`, `px-6`, `pt-4`: Controls inner whitespace.
- **Margin (Outside)**:
  - `m-6`, `mb-3`, `mb-4`, `mb-6`, `mb-8`, `mt-1`: Controls outer whitespace between elements.
- **Stacking Spacing**:
  - `space-y-4`, `space-y-6`: Adds vertical spacing evenly between direct child elements.
  - `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`: Controls the horizontal and vertical spacing within grid or flex containers.

## Typography

- **Sizing**:
  - `text-sm`, `text-xl`, `text-3xl`: Standardizes font sizes.
- **Weight**:
  - `font-medium`, `font-semibold`, `font-bold`: Controls text thickness.
- **Color**:
  - `text-neutral-900`, `text-neutral-700`, `text-neutral-600`, `text-neutral-500`: Standard text colors from the neutral palette.
  - `text-primary-600`: Branding colors for specific accents.
  - `dark:text-neutral-100`, `dark:text-neutral-300`, `dark:text-neutral-400`, `dark:text-primary-400`: Inverted colors for dark mode visibility.

## Decorative & Surface Effects

- **Backgrounds**:
  - `bg-white`, `bg-neutral-50`: Surface colors for cards and sections.
  - `bg-primary-50/30`, `bg-neutral-800/50`: Tinted backgrounds with specified opacity (the `/30` and `/50`).
  - `dark:bg-primary-950/30`, `dark:bg-neutral-900`: Dark mode background overrides.
- **Borders**:
  - `border`, `border-t`: Adds 1px borders (full or top only).
  - `border-neutral-100`, `border-neutral-200/60`, `border-secondary-200/60`, `border-primary-200/60`: Palette colors for borders with opacity variants.
  - `rounded-xl`, `rounded-lg`, `rounded-full`: Controls corner rounding/radius.
- **Shadows**:
  - `shadow-sm`: Adds a subtle elevation shadow.

## Interactivity & Transitions

- **Transitions**:
  - `transition-all`, `transition-transform`: Animates property changes.
  - `duration-300`: Sets the speed (300ms) for transitions.
- **Hover States**:
  - `hover:shadow-md`, `hover:shadow-lg`: Increases elevation when the mouse is over an element.
  - `hover:-translate-y-0.5`: Subtle upward lift effect on hover.
  - `hover:scale-102`, `hover:scale-105`: Subtle enlargement effect for interactive components.
- **Cursors**:
  - `cursor-pointer`: Forces the hand cursor to indicate clickability on custom link behaviors.
