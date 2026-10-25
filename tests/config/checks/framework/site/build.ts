export const BUILD_OUTPUT_CHECKS = [
    'site/html-validate',
    'site/purgecss',
    'site/lychee',
    'site/size',
    'site/sitemap',
] as const;

export const WORKSPACE_SITE_FILES = {
    'package.json': '{"private":true,"workspaces":["web","packages/*"]}',
    'web/package.json': '{"name":"web","type":"module","dependencies":{"core":"workspace:*"}}',
    'packages/core/package.json': '{"name":"core","type":"module","main":"value.js"}',
    'packages/core/value.js': 'export const value = "<h1>Workspace site</h1>";',
    'packages/unused/package.json': '{"name":"unused"}',
    'packages/unused/private.txt': 'Unrelated site bytes',
} as const;
