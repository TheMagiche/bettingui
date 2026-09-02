# Light Mode & Theme Switcher Implementation Plan

## Overview
Add a proper light/dark theme system with a toggle switcher to the bettingui app. Currently the app uses CSS `@media (prefers-color-scheme: dark)` for automatic theme switching, which gives users no manual control. We need to:

1. Replace automatic theme detection with manual control
2. Add a ThemeSwitcher component in the header
3. Persist user preference to localStorage
4. Support system preference as initial/default value

## Files to Modify

### 1. `app/globals.css`
- Add explicit `.light` and `.dark` class-based theme variables on `:root`
- Remove or keep the `@media (prefers-color-scheme: dark)` as fallback
- Add CSS variable `--theme` to track current mode for potential JS access

### 2. `app/layout.tsx`
- Make it a client component (add `"use client"`)
- Import and wrap children with `ThemeProvider`
- Pass initial theme from server (optional, can be done client-side)

### 3. `app/components/ThemeProvider.tsx` (NEW)
- React Context provider
- State: `theme: "light" | "dark"`
- Effects:
  - On mount: read `localStorage.getItem("theme")`, fallback to `system` preference via `window.matchMedia("(prefers-color-scheme: dark)")`
  - Apply `dark` class to `<html>` element when theme is dark
  - Update `localStorage` when theme changes
- Expose `toggleTheme()` and `setTheme()` functions

### 4. `app/components/ThemeSwitcher.tsx` (NEW)
- Button/toggle component
- Shows sun icon in dark mode, moon icon in light mode
- Accesses theme via `useTheme()` context
- Accessible: `aria-label`, keyboard support

### 5. `app/page.tsx`
- Import `ThemeSwitcher` and render in header
- Header currently at line ~896

## Implementation Details

### ThemeProvider Context API
```tsx
type Theme = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>(null!);
```

### CSS Variable Strategy
Use Tailwind's `dark` class variant:
- Add `class="dark"` to `<html>` when dark mode is active
- Existing `dark:*` utility classes will automatically work
- No need to change existing component classes

### Persistence
- Key: `theme` in localStorage
- Values: `"light"`, `"dark"`, `"system"`
- On load: if no stored value, use `system` and apply `prefers-color-scheme`

## Steps
1. Create `ThemeProvider.tsx` with context and logic
2. Create `ThemeSwitcher.tsx` with toggle UI
3. Update `layout.tsx` to use client-side rendering and wrap with provider
4. Update `globals.css` to support explicit class-based dark mode
5. Add `ThemeSwitcher` to header in `page.tsx`
6. Test both modes and persistence