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
