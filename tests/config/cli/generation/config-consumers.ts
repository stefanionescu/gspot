import { NATIVE_MISE_POLICY } from '#tests/config/samples/npm.ts';
import type { StylelintConsumerCase } from '#tests/types/cli/generation/configuration-files.ts';

/** Sibling Python projects with different enabled tools. */
export const NESTED_PYTHON_POLICY = `configurations = []
[[ignore]]
check = "python/basedpyright"
paths = ["linted/**"]
reason = "This project uses Ruff without a type checker."
[scope."linted"]
configurations = ["python"]
[scope."typed"]
configurations = ["python"]
[agent_rules]
enabled = false
`;

/** SwiftFormat remains active after both other external Swift checks are ignored. */
export const SWIFT_FORMAT_POLICY = `configurations = ["swift"]
${NATIVE_MISE_POLICY}[[ignore]]
check = "swift/swiftlint"
reason = "SwiftFormat owns this sandbox's formatting."
[[ignore]]
check = "swift/swiftlint-analyze"
reason = "This sandbox has no analyzer build log."
[[ignore]]
check = "swift/periphery"
reason = "This sandbox has no Xcode project."
[agent_rules]
enabled = false
`;

/** Only the native EditorConfig check consumes formatting configuration. */
export const EDITORCONFIG_POLICY = `configurations = ["format"]
[[ignore]]
check = "format/prettier"
reason = "This sandbox uses EditorConfig without Prettier."
[agent_rules]
enabled = false
`;

/** Framework parser packages require an active stylesheet consumer. */
export const STYLELINT_CONSUMERS: StylelintConsumerCase[] = [
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
];

/** Each scope owns its component dialect and nearest declared Tailwind dependency. */
export const STYLELINT_SCOPE_TABLES = `[scope."vue"]
configurations = ["css", "vue"]
[scope."svelte"]
configurations = ["css", "svelte"]
[scope."mixed"]
configurations = ["css", "vue", "svelte"]
`;

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
};
