export const KNIP_COMPONENT_FILES = {
    'package.json':
        '{"name":"native-project","private":true,"type":"module","workspaces":["child"],"dependencies":{"vue":"3.5.0","svelte":"5.57.0","astro":"7.3.2","@astrojs/mdx":"4.0.0"}}',
    'main.js': 'export const used = 1;\n',
    'native-tests/widget.js': 'export const fixture = 1;\n',
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
    'child/verification/widget.js': 'export const fixture = 1;\n',
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

export const KNIP_ENTRY_TABLES = `\ntest_files = ["native-tests/**"]\n[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript"]\ntest_files = ["child/verification/**"]\n[scope.tools.knip]\nentry = ["child/main.js"]\n`;

export const KNIP_PROGRAM_PACKAGE =
    '{"name":"native-project","private":true,"scripts":{"git":"git status","npm":"npx example","bun":"bunx example","missing":"missing-native-tool"}}';

export const KNIP_DEPENDENCY_PACKAGE =
    '{"name":"native-project","private":true,"type":"module","dependencies":{"vale":"0.0.0","fixture-unused-package":"1.0.0","prettier":"3.8.4","eslint-config-prettier":"10.1.8","@gspothq/eslint-plugin":"0.0.0"}}';

export const KNIP_POINTER_FILES = {
    'package.json': '{"name":"pointer-project","private":true,"type":"module","workspaces":["child"]}',
    'README.md': '# Pointer project\n',
    'child/README.md': '# Child pointer project\n',
    'main.js': 'export const root = 1;\n',
    'eslint.config.js': 'export default {};\n',
    'child/package.json': '{"name":"child-pointer-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/eslint.config.js': 'export default {};\n',
} as const;

export const KNIP_POINTER_TABLES = `\n[tools.knip]\nentry = ["main.js"]\n[[scope]]\npath = "child"\n\nconfigurations = ["javascript", "markdown"]\n[scope.tools.knip]\nentry = ["child/main.js"]\n`;

export const INVALID_KNIP_REPORTS = [
    '{}',
    '{"issues":{}}',
    '{"issues":[{"file":""}]}',
    '{"issues":[{"file":"source.js","unknown":[{"name":"lost"}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":1}]}]}',
    '{"issues":[{"file":"source.js","exports":[{"name":"value","line":0}]}]}',
    '{"issues":[{"file":"source.js","duplicates":[{"name":"value"}]}]}',
] as const;

export const KNIP_ARGV = [
    'node',
    '.gspot/node_modules/knip/bin/knip.js',
    '--config',
    '.gspot/config/knip.json',
    '--no-progress',
    '--reporter',
    'json',
    '--include',
] as const;
