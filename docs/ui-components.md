# UI Analysis: app/pages/index.vue

This document analyzes the components and composables used in the main landing page of the EGP Broker application.

## Components

### Nuxt UI Components
These components are part of the [@nuxt/ui](https://ui.nuxt.com/) (v3) library, providing a unified design system based on Tailwind CSS.

- **`<UPage>`**: A layout wrapper that provides standard page padding and structure.
- **`<UPageHero>`**: Renders a high-impact hero section including a title, subtitle, headline, and action buttons.
- **`<USeparator>`**: A horizontal line used to visually divide sections of the page.
- **`<UContainer>`**: A responsive container that centers content and limits its maximum width.
- **`<UCard>`**: A container component with slots for header, body, and footer, used here for the statistics sidebar.
- **`<UIcon>`**: A flexible icon component (using Lucide icons via Iconify) for visual cues.
- **`<UBadge>`**: Displays small, labeled status or count indicators (e.g., total article count).
- **`<UButton>`**: The standard button component used for user interactions like "Create article".

### Custom Project Components
These are specific to the EGP Broker application and are defined within the `app/components` directory.

- **`<LayoutPreferencesControls>`**
  - **Path**: [`app/components/layout/PreferencesControls.vue`](file:///Users/edwards/git/egp-broker/app/components/layout/PreferencesControls.vue)
  - **Purpose**: Provides the UI for users to change global application preferences, such as switching between "Grid" and "List" views for articles.
- **`<FeaturesPostCard>`**
  - **Path**: [`app/components/features/post/Card.vue`](file:///Users/edwards/git/egp-broker/app/components/features/post/Card.vue)
  - **Purpose**: Encapsulates the display logic for a single article or post. It handles different view modes (grid vs list) and provides actions like editing or deleting.
- **`FeaturesPostCreateModal`**
  - **Path**: [`app/components/features/post/CreateModal.vue`](file:///Users/edwards/git/egp-broker/app/components/features/post/CreateModal.vue)
  - **Purpose**: A modal component that contains the form for creating or editing an article. It is invoked programmatically via the overlay system.

## Composables

### Module & Core Composables
- **`useI18n()`** ([@nuxtjs/i18n](https://i18n.nuxtjs.org/)): Provides the `t` function for translating text based on the active locale.
- **`useUserSession()`** ([nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils)): Manages the current user's authentication state and session data.
- **`useLocalePath()`** ([@nuxtjs/i18n](https://i18n.nuxtjs.org/)): Helper to resolve routes correctly with the current language prefix.
- **`useOverlay()`** ([@nuxt/ui](https://ui.nuxt.com/)): The programmatic API for opening modals and slide-overs (part of the Nuxt UI v3 overlay system).
- **`useFetch()`** (Nuxt Core): Handled SSR-friendly data fetching from the backend API (e.g., retrieving the posts list).

### Custom Project Composables
- **`usePreferences()`**
  - **Path**: [`app/composables/stores/usePreferences.ts`](file:///Users/edwards/git/egp-broker/app/composables/stores/usePreferences.ts)
  - **Purpose**: A bridge to the Pinia store (`usePreferencesStore`) that tracks user UI settings across the application.
- **`useSeo()`**
  - **Path**: [`app/composables/features/useSeo.ts`](file:///Users/edwards/git/egp-broker/app/composables/features/useSeo.ts)
  - **Purpose**: A wrapper around `useSeoMeta` that automatically pulls page titles and descriptions from the i18n translation files based on a provided key (e.g., `home`).
