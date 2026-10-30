import { GSPOT_PATHS } from '#cli/config/files/gspot.ts';

export const KNIP_COMPONENT_FILES = {
    'package.json':
        '{"name":"native-project","private":true,"type":"module","workspaces":["child"],"dependencies":{"vue":"3.5.0","svelte":"5.57.0","astro":"7.3.2","@astrojs/mdx":"4.0.0"}}',
    'main.js': 'export const used = 1;\n',
    'native-tests/widget.js': 'export const widget = 1;\n',
    'space name.jsx': 'export const unused = <div />;\n',
    'unused.vue': '<template><div>Unused</div></template>\n',
    'unused.svelte': '<div>Unused</div>\n',
    'unused.astro': `---
const unused = 1;
---
<div />
`,
    'unused.mdx': '# Unused\n',
    'child/package.json': '{"name":"child-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/verification/widget.js': 'export const widget = 1;\n',
    'child/unused.jsx': 'export const unused = <div />;\n',
} as const;

export const KNIP_UNUSED_FILES = [
    'child/unused.jsx',
    'space name.jsx',
    'unused.astro',
    'unused.mdx',
    'unused.svelte',
    'unused.vue',
] as const;

export const KNIP_LINK_FILES = {
    'package.json': '{"name":"pointer-project","private":true,"type":"module","workspaces":["child"]}',
    'README.md': '# Link file project\n',
    'child/README.md': '# Child link file project\n',
    'main.js': 'export const root = 1;\n',
    'eslint.config.js': 'export default {};\n',
    'child/package.json': '{"name":"child-pointer-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/eslint.config.js': 'export default {};\n',
} as const;

export const KNIP_ARGUMENTS = [
    'node',
    `${GSPOT_PATHS.nodeModules}/knip/bin/knip.js`,
    '--no-progress',
    '--reporter',
    'json',
] as const;

export const KNIP_WORKSPACE_FILES = {
    'package.json': '{"private":true,"type":"module","workspaces":["api","web"]}\n',
    'api/package.json': '{"name":"api","private":true}\n',
    'api/serve.js': '',
    'web/package.json': '{"name":"web","private":true}\n',
    'lib/index.js': '',
} as const;
