import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';

export const BUILD_OUTPUT_CHECKS = [
    'site/html-validate',
    'site/purgecss',
    'site/lychee',
    'site/size',
    'site/sitemap',
] as const;

export const SITE_BUILD_SCRIPT = `import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
const hadOutput = existsSync('dist/index.html');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
writeFileSync('dist/index.html', hadOutput ? 'second' : 'first');
`;

export const WORKSPACE_SITE_FILES = {
    'gspot.toml': buildSandboxSettings([], {
        scopes: [{ path: 'web', configurations: ['site', 'javascript'] }],
        tables: 'site.build_command = ["bun", "build.js"]\n',
    }),
    'package.json': '{"private":true,"workspaces":["web","packages/*"]}',
    'web/package.json': '{"name":"web","type":"module","dependencies":{"core":"workspace:*"}}',
    'web/build.js':
        'import {mkdirSync,writeFileSync} from "node:fs"; import {value} from "core"; mkdirSync("dist"); writeFileSync("dist/index.html",value);',
    'packages/core/package.json': '{"name":"core","type":"module","main":"value.js"}',
    'packages/core/value.js': 'export const value = "<h1>Workspace site</h1>";',
    'packages/unused/package.json': '{"name":"unused"}',
    'packages/unused/private.txt': 'Unrelated site bytes',
} as const;
