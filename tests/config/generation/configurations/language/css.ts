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
