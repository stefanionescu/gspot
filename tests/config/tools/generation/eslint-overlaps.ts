export const OVERLAP_SOURCES = {
    literal: 'export const pattern = /[]/;\n',
    constructor: "export const pattern = new RegExp('[]');\n",
    template: 'export const pattern = new RegExp(`[]`);\n',
    intersection: "export const pattern = new RegExp('[a&&b]', 'v');\n",
    negated: 'export const pattern = /[^]/;\n',
    escaped: 'export const pattern = /\\[\\]/;\n',
    rethrow: "export function run() { try { console.log('ready'); } catch (error) { throw error; } }\n",
    finalizer:
        "export function run() { try { console.log('ready'); } catch (error) { throw error; } finally { console.log('done'); } }\n",
    transformed: "export function run() { try { console.log('ready'); } catch ({ message }) { throw { message }; } }\n",
    handled:
        "export function run() { try { console.log('ready'); } catch (error) { console.log(error); throw error; } }\n",
    nested: "export function run() { if (Date.now()) { if (Math.random()) { console.log('ready'); } } }\n",
    blockless: "export function run() { if (Date.now()) if (Math.random()) console.log('ready'); }\n",
    alternate:
        "export function run() { if (Date.now()) { if (Math.random()) { console.log('ready'); } else { console.log('waiting'); } } }\n",
};

export const OVERLAP_PROJECT = {
    'package.json': '{"private":true,"type":"module"}\n',
    'tsconfig.json':
        '{"compilerOptions":{"target":"ES2022","module":"NodeNext","moduleResolution":"NodeNext","types":[]},"include":["*.ts"]}\n',
    'literal.js': OVERLAP_SOURCES.literal,
    'literal.ts': OVERLAP_SOURCES.literal,
    'constructor.js': OVERLAP_SOURCES.constructor,
    'constructor.ts': OVERLAP_SOURCES.constructor,
    'template.js': OVERLAP_SOURCES.template,
    'template.ts': OVERLAP_SOURCES.template,
    'intersection.js': OVERLAP_SOURCES.intersection,
    'intersection.ts': OVERLAP_SOURCES.intersection,
    'negated.js': OVERLAP_SOURCES.negated,
    'negated.ts': OVERLAP_SOURCES.negated,
    'escaped.js': OVERLAP_SOURCES.escaped,
    'escaped.ts': OVERLAP_SOURCES.escaped,
    'rethrow.js': OVERLAP_SOURCES.rethrow,
    'rethrow.ts': OVERLAP_SOURCES.rethrow,
    'finalizer.js': OVERLAP_SOURCES.finalizer,
    'finalizer.ts': OVERLAP_SOURCES.finalizer,
    'transformed.js': OVERLAP_SOURCES.transformed,
    'transformed.ts': OVERLAP_SOURCES.transformed,
    'handled.js': OVERLAP_SOURCES.handled,
    'handled.ts': OVERLAP_SOURCES.handled,
    'nested.js': OVERLAP_SOURCES.nested,
    'nested.ts': OVERLAP_SOURCES.nested,
    'blockless.js': OVERLAP_SOURCES.blockless,
    'blockless.ts': OVERLAP_SOURCES.blockless,
    'alternate.js': OVERLAP_SOURCES.alternate,
    'alternate.ts': OVERLAP_SOURCES.alternate,
};

export const OVERLAP_CORRECTION = "export const pattern = /[a]/;\nexport function run() { console.log('ready'); }\n";

export const OVERLAP_SEVERITIES = {
    'no-empty-character-class': [0],
    'regexp/no-empty-character-class': [2],
    'sonarjs/no-empty-character-class': [0],
    'no-useless-catch': [2],
    'sonarjs/no-useless-catch': [0],
    'unicorn/no-lonely-if': [0],
    'sonarjs/no-collapsible-if': [2],
};

export const OVERLAP_FINDINGS = {
    alternate: [],
    blockless: [{ ruleId: 'sonarjs/no-collapsible-if', line: 1, column: 25, severity: 2 }],
    constructor: [{ ruleId: 'regexp/no-empty-character-class', line: 1, column: 36, severity: 2 }],
    escaped: [],
    finalizer: [{ ruleId: 'no-useless-catch', line: 1, column: 55, severity: 2 }],
    handled: [],
    intersection: [{ ruleId: 'regexp/no-empty-character-class', line: 1, column: 36, severity: 2 }],
    literal: [{ ruleId: 'regexp/no-empty-character-class', line: 1, column: 25, severity: 2 }],
    negated: [],
    nested: [{ ruleId: 'sonarjs/no-collapsible-if', line: 1, column: 25, severity: 2 }],
    rethrow: [{ ruleId: 'no-useless-catch', line: 1, column: 25, severity: 2 }],
    template: [{ ruleId: 'regexp/no-empty-character-class', line: 1, column: 35, severity: 2 }],
    transformed: [],
};

export const OVERLAP_SCRIPT = `import { basename } from 'node:path';
import { ESLint } from 'eslint';
const eslint = new ESLint({ overrideConfigFile: '.gspot/config/eslint.config.mjs' });
const names = ['no-empty-character-class', 'regexp/no-empty-character-class', 'sonarjs/no-empty-character-class',
    'no-useless-catch', 'sonarjs/no-useless-catch', 'unicorn/no-lonely-if', 'sonarjs/no-collapsible-if'];
const configurations = {};
for (const file of ['literal.js', 'literal.ts']) {
    const config = await eslint.calculateConfigForFile(file);
    configurations[file] = Object.fromEntries(names.map((name) => [name, config.rules[name]]));
}
const results = await eslint.lintFiles(['*.js', '*.ts']);
process.stdout.write(JSON.stringify({ configurations,
    files: results.map(({ filePath, messages }) => ({ file: basename(filePath),
        findings: messages.filter(({ ruleId, fatal }) => names.includes(ruleId) || fatal)
            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
    })),
}));
`;
