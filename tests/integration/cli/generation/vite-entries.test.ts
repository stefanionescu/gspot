// The generated ESLint configuration keeps the structural rules on Vite entry files, whatever knip names as entries.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { generatedEslint } from '#tests/harness/cli/generated.ts';

const VITE_POLICY = `level = "all"
kits = ["javascript"]
[guides]
install = false
[tools.knip]
entry = []
[[scope]]
path = "api"
kits = ["javascript"]
[scope.tools.knip]
entry = []
`;

const START = "import { start } from './start.js';\nstart();\n";
const STARTER =
    'export function start() { const target = document.querySelector("#app"); if (!target) throw new Error("Missing application target"); target.textContent = "Started"; }\n';
const ENTRY_FILES = ['api/src/main.js', 'api/src/task.js', 'src/main.js', 'src/task.js'];

// The files and rules the generated configuration reports among the two rules about trivial code.
async function trivialFindings(root: string, policy: string): Promise<{ file: string; rule: string | null }[]> {
    writeFileSync(join(root, 'gspot.toml'), policy);
    const eslint = await generatedEslint(root);
    const results = await eslint.lintFiles(['src', 'api/src']);
    return results.flatMap(({ filePath, messages }) =>
        messages
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions')
            .map(({ ruleId }) => ({ file: filePath.slice(root.length + 1).replaceAll('\\', '/'), rule: ruleId })),
    );
}

// The files the trivial-file rule reports, sorted.
function trivialFiles(findings: { file: string; rule: string | null }[]): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted((left, right) => left.localeCompare(right));
}

test('Vite entry files keep the structural rules at both levels and in nested scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"entry-sandbox","private":true,"type":"module","devDependencies":{"vite":"8.3.0"}}',
        'index.html': '<!doctype html><script type="module" src="/src/main.js"></script>',
        'src/start.js': STARTER,
        'src/main.js': START,
        'src/task.js': START,
        'api/src/start.js': STARTER,
        'api/src/main.js': START,
        'api/src/task.js': START,
    });
    for (const policy of [
        VITE_POLICY,
        VITE_POLICY.replace('entry = []', 'entry = ["api/src/main.js"]'),
        VITE_POLICY.replaceAll('entry = []', 'entry = ["src/*.js", "!src/task.js"]'),
    ])
        expect(trivialFiles(await trivialFindings(sandbox.path, policy))).toStrictEqual(ENTRY_FILES);
    writeFileSync(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nexport function boot() { start(); }\n",
    );
    for (const level of ['recommended', 'all']) {
        const policy = VITE_POLICY.replace('level = "all"', `level = "${level}"`)
            .replace(
                '[tools.knip]',
                '[tools.eslint.rules]\n"gspot/no-trivial-functions" = "error"\n"gspot/no-trivial-files" = "error"\n[tools.knip]',
            )
            .replaceAll('entry = []', 'entry = ["src/main.js"]');
        const findings = await trivialFindings(sandbox.path, policy);
        expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual([
            { file: 'src/main.js', rule: 'gspot/no-trivial-files' },
            { file: 'src/main.js', rule: 'gspot/no-trivial-functions' },
        ]);
        expect(trivialFiles(findings)).toStrictEqual(ENTRY_FILES);
    }
});
