/** Native component extensions supplied by Knip's framework compilers. */
export const KNIP_COMPONENT_FILES = {
    'package.json':
        '{"name":"native-project","private":true,"type":"module","workspaces":["child"],"dependencies":{"vue":"3.5.0","svelte":"5.57.0","astro":"7.3.2","@astrojs/mdx":"4.0.0"}}',
    'main.js': 'export const used = 1;\n',
    'native-tests/widget.js': 'export const fixture = 1;\n',
    'space name.jsx': 'export const unused = <div />;\n',
    'unused.vue': '<template><div>Unused</div></template>\n',
    'unused.svelte': '<div>Unused</div>\n',
    'unused.astro': '---\nconst unused = 1;\n---\n<div />\n',
    'unused.mdx': '# Unused\n',
    'child/package.json': '{"name":"child-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/verification/widget.js': 'export const fixture = 1;\n',
    'child/unused.jsx': 'export const unused = <div />;\n',
};

/** Framework files outside native entry locations remain unused. */
export const KNIP_UNUSED_FILES = [
    'child/unused.jsx',
    'space name.jsx',
    'unused.astro',
    'unused.mdx',
    'unused.svelte',
    'unused.vue',
];

/** Root and child entry points are declared through their existing project settings. */
export const KNIP_ENTRY_TABLES = `
test_files = ["native-tests/**"]
[tools.knip]
entry = ["main.js"]
[scope."child"]
configurations = ["javascript"]
test_files = ["verification/**"]
[scope."child".tools.knip]
entry = ["main.js"]
`;

/** Native ignored global binaries and one actionable control. */
export const KNIP_BINARY_PACKAGE =
    '{"name":"native-project","private":true,"scripts":{"git":"git status","npm":"npx example","bun":"bunx example","missing":"missing-native-tool"}}';

/** Unselected dependency names remain actionable even when selected tooling is ignored. */
export const KNIP_DEPENDENCY_PACKAGE =
    '{"name":"native-project","private":true,"type":"module","dependencies":{"vale":"0.0.0","fixture-unused-package":"1.0.0","prettier":"3.8.4","eslint-config-prettier":"10.1.8","@gspothq/eslint-plugin":"0.0.0"}}';

/** Native exports and missing dependencies need distinct diagnostics and repair guidance. */
export const KNIP_DIAGNOSTIC_FILES = {
    'package.json': '{"name":"native-project","private":true,"type":"module"}',
    'main.js': "import { used } from './space source.js';\nconsole.log(used);\n",
    'space source.js':
        "import 'fixture-missing-package';\nexport const used = 1;\nexport const unused = 2;\nexport { used as alias };\n",
};

/** Declared root and child pointers must not hide other configuration-shaped source files. */
export const KNIP_POINTER_FILES = {
    'package.json': '{"name":"pointer-project","private":true,"type":"module","workspaces":["child"]}',
    'README.md': '# Pointer project\n',
    'child/README.md': '# Child pointer project\n',
    'main.js': 'export const root = 1;\n',
    'eslint.config.js': 'export default {};\n',
    'child/package.json': '{"name":"child-pointer-project","private":true,"type":"module"}',
    'child/main.js': 'export const child = 1;\n',
    'child/eslint.config.js': 'export default {};\n',
};

/** Both native scopes select the declarations that own their actual pointer paths. */
export const KNIP_POINTER_TABLES = `
[tools.knip]
entry = ["main.js"]
[scope.child]
configurations = ["javascript", "markdown"]
[scope.child.tools.knip]
entry = ["main.js"]
`;
