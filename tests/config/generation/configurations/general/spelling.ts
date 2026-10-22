/** Settings with a British spelling scope. */
export const BRITISH_SCOPE_SETTINGS = {
    level: 'all',
    tables: `[[scope]]
path = "british"
spelling.locale = "en-gb"
[[scope]]
path = "british/american"
spelling.locale = "en-us"
`,
} as const;
