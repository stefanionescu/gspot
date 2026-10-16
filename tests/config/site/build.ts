import { ALT_TEXT_PAGE } from '#tests/config/site/built-pages.ts';

export const BUILD_OUTPUT_CHECKS = [
    'site/html-validate',
    'site/purgecss',
    'site/linkinator',
    'site/linkinator-external',
    'site/size',
    'site/sitemap',
] as const;

/** Package manager inputs used for the resolved site build default. */
export const SITE_NPM_CLIENT_CASES = [
    ['npm fallback', {}, 'npm'],
    ['declared Bun', { 'package.json': '{"packageManager":"bun@1.4.2"}' }, 'bun'],
] as const;

export const SITE_BUILD_COMMANDS = [
    ['custom-builder', '', 'two words'],
    ['npm', 'run', 'build'],
] as const;

export const SITE_CASES = [
    {
        check: 'site/build',
        files: { 'build.js': "throw new Error('the build is broken');\n" },
        expected: { file: '', rule: 'build', line: 1 },
    },
] as const;

/** Each scope copies its own authored page into its built output. */
export const COPY_PAGE_BUILD = `import { mkdirSync, copyFileSync } from 'node:fs';
mkdirSync('dist', { recursive: true });
copyFileSync('page.html', 'dist/index.html');
`;

/** The root owns HTML; two sites own their builds and one whole-scope accessibility exception. */
export const TWO_SITE_SCOPES = `[[ignore]]
check = "site/html-validate"
rule = "wcag/h37"
paths = ["app/**"]
reason = "Application alternative text is supplied by the rendering environment."
[[scope]]
path = "app"
configurations = ["site"]
site.build_command = ["node", "build.mjs"]
site.build_folder = "app/dist"
[[scope]]
path = "other"
configurations = ["site"]
site.build_command = ["node", "build.mjs"]
site.build_folder = "other/dist"
`;

/** Site-only scopes and sites below an HTML owner both keep native rule exceptions confined. */
export const BUILT_HTML_SITES = [
    { name: 'a root HTML configuration', configurations: ['html'], files: { 'index.html': ALT_TEXT_PAGE } },
    { name: 'site-only child configurations', configurations: [], files: {} },
] as const;

export const SITE_BUILD_SCRIPT = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
// Distinguish a fresh build from a rebuild of existing output.
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;

export const SITE_OUTPUT_BUILD = `import { cp, rm } from 'node:fs/promises';
await rm('dist', { recursive: true, force: true });
await cp('pages', 'dist', { recursive: true });
`;

/** Settings that select the site build checks at level all. */
export const SITE_SETTINGS = `level = "all"
configurations = ["site"]
[site]
build_command = ["bun", "build.js"]
`;

export const WORKSPACE_SITE_FILES = {
    'gspot.toml': `configurations = []
[[scope]]
path = "web"
configurations = ["site", "javascript"]
site.build_command = ["bun", "build.js"]
[rules]
enabled = false
`,
    'package.json': '{"private":true,"workspaces":["web","packages/*"]}',
    'web/package.json': '{"name":"web","type":"module","dependencies":{"core":"workspace:*"}}',
    'web/build.js':
        'import {mkdirSync,writeFileSync} from "node:fs"; import {value} from "core"; mkdirSync("dist"); writeFileSync("dist/index.html",value);',
    'packages/core/package.json': '{"name":"core","type":"module","main":"value.js"}',
    'packages/core/value.js': 'export const value = "<h1>Workspace site</h1>";',
    'packages/unused/package.json': '{"name":"unused"}',
    'packages/unused/private.txt': 'Unrelated site bytes',
} as const;
