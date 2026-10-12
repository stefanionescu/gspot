/** Framework parser packages require an active stylesheet consumer. */
export const STYLESHEET_CASES = [
    { name: 'plain CSS', configurations: ['css'], files: { 'site.css': 'a { color: red; }' }, needsHtmlParser: false },
    {
        name: 'Vue styles',
        configurations: ['css', 'vue'],
        files: { 'Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>' },
        needsHtmlParser: true,
    },
    {
        name: 'Svelte styles',
        configurations: ['css', 'svelte'],
        files: { 'Card.svelte': '<p>Card</p><style>p { color: red; }</style>' },
        needsHtmlParser: true,
    },
    {
        name: 'Vue without Stylelint',
        configurations: ['vue'],
        files: { 'Card.vue': '<template><p>Card</p></template>' },
        needsHtmlParser: false,
    },
    {
        name: 'Svelte without Stylelint',
        configurations: ['svelte'],
        files: { 'Card.svelte': '<p>Card</p>' },
        needsHtmlParser: false,
    },
] as const;

/** Each scope owns its component dialect and nearest declared Tailwind dependency. */
export const STYLELINT_SCOPE_TABLES = `[[scope]]\npath = "vue"\nconfigurations = ["css", "vue"]\n[[scope]]\npath = "svelte"\n\nconfigurations = ["css", "svelte"]\n[[scope]]\npath = "mixed"\n\nconfigurations = ["css", "vue", "svelte"]\n`;

export const STYLELINT_SCOPE_FILES = {
    'package.json': '{"private":true}',
    'site.css': 'a { color: red; }',
    'vue/package.json': '{"private":true,"dependencies":{"vue":"3.5.22","tailwindcss":"4.1.13"}}',
    'vue/Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>',
    'svelte/package.json': '{"private":true,"dependencies":{"svelte":"5.57.0"}}',
    'svelte/Card.svelte': '<p>Card</p><style>p { color: red; }</style>',
    'mixed/package.json': '{"private":true,"dependencies":{"vue":"3.5.22","svelte":"5.57.0"}}',
    'mixed/Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>',
    'mixed/Card.svelte': '<p>Card</p><style>p { color: red; }</style>',
} as const;

/** Authored package data whose Stylelint field hides the generated pointer. */
export const STYLELINT_PACKAGE_JSON = `{
  "name": "native-project",
  "private": true,
  "type": "module",
  "stylelint": {"rules":{"property-no-unknown":null}}
}
`;

/** Shared authored files that must survive managed native configuration changes. */
export const STYLELINT_FILES = {
    'package.json': STYLELINT_PACKAGE_JSON,
    'source.css': 'a { opacity: 1; }\n',
    'app/package.json': STYLELINT_PACKAGE_JSON,
    'app/source.css': 'a { opacity: 1; }\n',
    'app/child/package.json': STYLELINT_PACKAGE_JSON,
    'other/package.json': STYLELINT_PACKAGE_JSON,
    'plain/package.json': '{"private":true}\n',
} as const;

/** Unowned shared sections remain reviewable without suggesting deletion of their packages. */
export const STYLELINT_SUGGESTIONS = [
    {
        path: 'app/child/package.json',
        command: 'move any stylelint setting you still need into gspot.toml, then delete the section',
    },
    {
        path: 'other/package.json',
        command: 'move any stylelint setting you still need into gspot.toml, then delete the section',
    },
] as const;

/** Authored source names do not prove build output; both stylesheets remain lint inputs. */
export const STYLESHEETS = {
    'build/site.css': `a {
    color: #ff0000;
    width: 1.5px;
    -webkit-text-size-adjust: 100%;
}
`,
    'app/site.css': `#example {
    color: #f00;
    width: 1.5px;
    -webkit-backdrop-filter: blur(2px);
}
`,
} as const;

/** Active rule options inherit across scopes. Inactive native options cannot add checks. */
export const STYLELINT_SETTINGS = `[tools.stylelint.rules]\ncolor-hex-length = "short"\nnumber-max-precision = 0\nselector-max-id = 0\n[[scope]]\npath = "app"\n\nconfigurations = []\n[scope.tools.stylelint.rules]\ncolor-hex-length = "long"\n`;

/** Standard properties and scoped color options correct all selected-level findings. */
export const FIXED_STYLESHEETS = {
    'build/site.css': `a {
    color: #f00;
    width: 1px;
    text-size-adjust: 100%;
}
`,
    'app/site.css': `#example {
    color: #ff0000;
    width: 1px;
    backdrop-filter: blur(2px);
}
`,
} as const;

/** Tailwind syntax follows the declaring package boundary. */
export const TAILWIND_FILES = {
    'package.json': '{"private":true,"dependencies":{"next":"16.3.5"}}\n',
    'build/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
    'app/package.json': '{"private":true,"devDependencies":{"tailwindcss":"4.1.13"}}\n',
    'app/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
    'other/package.json': '{"private":true}\n',
    'other/site.css': `@tailwind utilities;

a {
    color: theme("colors.brand");
}
`,
} as const;

export const TAILWIND_SETTINGS = `[[scope]]\npath = "app"\n\nconfigurations = ["css"]\n[[scope]]\npath = "other"\n\nconfigurations = ["css"]\n`;

/** A property the native Stylelint owner must reject at both levels. */
export const INVALID_CSS = `a {
    invalid-property: 1;
}
`;

export const VALID_CSS = `a {
    opacity: 1;
}
`;
