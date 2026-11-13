import type { SelectorSample } from '#tests/types/configurations.ts';

const MODULE_PACKAGE = '{"private":true,"type":"module"}\n';

const LITERAL_CALLS = ['[]', 'class {}', '{}', '42', '`text`'].flatMap((expression) => [
    `(${expression})();`,
    `(${expression})\`text\`;`,
]);

const REGISTRY_LOOP = 'const registry = new Map();\nfor (const name of ["a", "b"]) registry.set(name, name.length);\n';

export const STANDALONE_BLOCK_FILES = {
    'package.json': MODULE_PACKAGE,
    'source.js':
        'export const first = 1;\n{\n    console.info(first);\n}\nexport function pick(kind) {\n    {\n        console.info(kind);\n    }\n    switch (kind) {\n        case 1: {\n            return 1;\n        }\n        default: {\n            return 0;\n        }\n    }\n}\n',
} as const;

export const BASE_SELECTOR_SAMPLES: readonly SelectorSample[] = [
    {
        name: 'a template message to a logger method, including log, is reported, and console.log is not',
        configurations: ['javascript'],
        level: 'all',
        message: 'Log a stable',
        files: {
            'package.json': MODULE_PACKAGE,
            'source.js':
                'export function report(logger, count) {\n    logger.log(`Saved ${count}`);\n    logger.info(`Read ${count}`);\n    console.log(`Printed ${count}`);\n}\n',
        },
        findings: { 'source.js': [2, 3] },
    },
    {
        name: 'a block that stands alone is reported at the top of a file and inside a function, and a case block is not',
        configurations: ['javascript'],
        level: 'all',
        message: 'A block that stands',
        files: STANDALONE_BLOCK_FILES,
        findings: { 'source.js': [2, 6] },
    },
    {
        name: 'the JavaScript security selectors report unsafe sinks and pass fixed forms',
        configurations: ['javascript'],
        level: 'basic',
        files: {
            'package.json': MODULE_PACKAGE,
            'html.js': `list.innerHTML = "";
list.innerHTML = "<li>None</li>";
list.innerHTML = name;
list.outerHTML = markup;
list.insertAdjacentHTML("beforeend", markup);
document.write(markup);
list.textContent = markup;
`,
            'request.js': `fetch(new URL(request.url).searchParams.get("target"));
fetch(req.query.target);
fetch(context.request.url, { cf: { cacheTtl: 5 } });
fetch("https://example.com/api");
`,
            'log.js': `console.info(process.env.API_TOKEN);
auditLogger.warn(process.env.API_SECRET);
this.logger.error(process.env.PASSWORD);
applicationLog.trace(process.env.CREDENTIAL);
console.log(Deno.env.get("API_SECRET"));
console.info(process.env.PORT);
storage.write(process.env.API_TOKEN);
logger.info("Token refreshed");
`,
            'exec.js': `execSync(\`printf \${input}\`);
exec(\`ls \${folder}\`);
execFileSync("printf", [input]);
`,
        },
        findings: { 'exec.js': [1, 2], 'html.js': [3, 4, 5, 6], 'log.js': [1, 2, 3, 4, 5], 'request.js': [1, 2] },
    },
    {
        name: 'invalid literal calls and template tags are reported at level basic',
        configurations: ['javascript'],
        level: 'basic',
        files: { 'package.json': MODULE_PACKAGE, 'literal.js': LITERAL_CALLS.join('\n') },
        findings: { 'literal.js': LITERAL_CALLS.map((_, index) => index + 1) },
        corrected: {
            'literal.js': [
                '(function() {})();',
                '(() => {})();',
                'new (class {})();',
                'call();',
                'tag`text`;',
                '[call][0]();',
            ].join('\n'),
        },
    },
    {
        name: 'package entry-point imports are reported at level basic',
        configurations: ['javascript'],
        level: 'basic',
        files: {
            'package.json': MODULE_PACKAGE,
            'imports.js': 'import value from "./node_modules/example/private";',
            'require.js': 'const value = require("./node_modules/example/private");',
        },
        findings: { 'imports.js': [1], 'require.js': [1] },
        corrected: {
            'imports.js': 'import value from "example";',
            'require.js': 'const value = require("example");',
        },
    },
    {
        name: 'empty-object fallbacks are reported at level basic',
        configurations: ['javascript'],
        level: 'basic',
        files: {
            'package.json': MODULE_PACKAGE,
            'source.js': `export function fallback(value) {
    const alternate = value || {};
    return alternate ?? {};
}
export const known = (value) => value ?? { known: true };
`,
        },
        findings: { 'source.js': [2, 3] },
    },
    {
        name: 'a jump at the end of a loop is reported at level basic',
        configurations: ['javascript'],
        level: 'basic',
        files: { 'package.json': MODULE_PACKAGE, 'jump.js': 'for (const item of items) { use(item); continue; }' },
        findings: { 'jump.js': [1] },
        corrected: { 'jump.js': 'for (const item of items) { use(item); }' },
    },
    {
        name: 'a character class that matches any character is reported at level basic',
        configurations: ['javascript'],
        level: 'basic',
        files: {
            'package.json': MODULE_PACKAGE,
            'dot.js': String.raw`export const found = /a[\s\S]b/s.test(text);`,
        },
        findings: { 'dot.js': [1] },
        corrected: { 'dot.js': 'export const found = /a.b/s.test(text);' },
    },
    {
        name: 'an assignment in a call argument and the deletion of a value are reported at level all',
        configurations: ['javascript'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'assignment.js': 'send(value = read());',
            'delete.js': 'delete 42;',
        },
        findings: { 'assignment.js': [1], 'delete.js': [1] },
        corrected: { 'assignment.js': 'value = read(); send(value);', 'delete.js': 'delete value.key;' },
    },
    {
        name: 'assignment selectors allow their parent contexts',
        configurations: ['javascript'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'contexts.js': [
                'call(value = read());',
                '1 + (value = read());',
                '(value = read()) || other;',
                'if (value = read()) run();',
                'for (; value = read(); count++) run();',
                'function read() { return value = fetch(); }',
                'delete read();',
            ].join('\n'),
        },
        findings: { 'contexts.js': [1, 2, 3, 4, 5, 6, 7] },
        corrected: {
            'contexts.js': [
                'value = read();',
                'first = second = read();',
                'const result = value = read();',
                'if ((value = read()) !== null) run();',
                'for (; ready; count++, value = read()) run();',
                'const fetch = () => value = read();',
                'ready && (value = read());',
                'while (value = read()) run();',
                'do run(); while (value = read());',
                'for (value = read(); ready; value = read()) run();',
                'delete value?.key;',
            ].join('\n'),
        },
    },
    {
        name: 'at level all, a module that exports values runs no top-level loop or branch, and a script or config file may',
        configurations: ['javascript'],
        level: 'all',
        files: {
            'package.json': MODULE_PACKAGE,
            'registry.js': `${REGISTRY_LOOP}if (registry.size > 0) registry.clear();\nexport { registry };\n`,
            'build.js': REGISTRY_LOOP,
            'tool.config.js': `${REGISTRY_LOOP}export default registry;\n`,
        },
        findings: { 'registry.js': [2, 3] },
    },
];
