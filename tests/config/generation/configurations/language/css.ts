export const STYLELINT_SCOPE_FILES = {
    'package.json': '{"private":true}',
    'site.css': 'a { color: red; }',
    'vue/package.json': '{"private":true,"dependencies":{"vue":"0.0.0-test","tailwindcss":"0.0.0-test"}}',
    'vue/Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>',
    'svelte/package.json': '{"private":true,"dependencies":{"svelte":"0.0.0-test"}}',
    'svelte/Card.svelte': '<p>Card</p><style>p { color: red; }</style>',
    'mixed/package.json': '{"private":true,"dependencies":{"vue":"0.0.0-test","svelte":"0.0.0-test"}}',
    'mixed/Card.vue': '<template><p>Card</p></template><style>p { color: red; }</style>',
    'mixed/Card.svelte': '<p>Card</p><style>p { color: red; }</style>',
} as const;

export const COMPONENT_SYNTAX_OVERRIDES = [
    { files: ['**/*.vue'], customSyntax: 'postcss-html' },
    { files: ['**/*.svelte'], customSyntax: 'postcss-html' },
    { files: ['**/*.astro'], customSyntax: 'postcss-html' },
];
