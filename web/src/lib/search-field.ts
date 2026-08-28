/** Keep password managers (Dashlane, 1Password, LastPass) off search fields. */
export const SEARCH_FIELD_PROPS = {
  type: "search" as const,
  name: "site-search",
  autoComplete: "off" as const,
  autoCorrect: "off" as const,
  autoCapitalize: "off" as const,
  spellCheck: false,
  suppressHydrationWarning: true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
  "data-dashlane-ignored": "true",
};

/** Same extension guards for toolbar buttons — prevents Dashlane hydration mismatches. */
export const TOOLBAR_BUTTON_PROPS = {
  suppressHydrationWarning: true,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
  "data-dashlane-ignored": "true",
} as const;
