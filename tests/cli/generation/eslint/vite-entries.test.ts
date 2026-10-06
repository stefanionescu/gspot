// The generated ESLint configuration keeps the structural rules on Vite entry files, whatever knip names as entries.
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { testdir, createFileTree } from 'testdirs';
import { createEslint } from '#tests/harness/generated.ts';
import type { FileRuleFinding } from '#tests/types/generation/findings.ts';
import { START, STARTER, VITE_POLICY, TRIVIAL_FILES } from '#tests/config/cli/generation/eslint/vite-entries.ts';

// The files and rules the generated configuration reports among the two rules about trivial code.
async function trivialFindings(root: string, policy: string): Promise<Pick<FileRuleFinding, 'file' | 'rule'>[]> {
    writeFileSync(join(root, 'gspot.toml'), policy);
    const eslint = await createEslint(root);
    const results = await eslint.lintFiles(['src', 'api/src']);
    return results.flatMap(({ filePath, messages }) =>
        messages
            .filter(({ ruleId }) => ruleId === 'gspot/no-trivial-files' || ruleId === 'gspot/no-trivial-functions')
            .map(({ ruleId }) => ({ file: filePath.slice(root.length + 1).replaceAll('\\', '/'), rule: ruleId })),
    );
}

// The files the trivial-file rule reports, sorted.
function trivialFiles(findings: Pick<FileRuleFinding, 'file' | 'rule'>[]): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted((left, right) => left.localeCompare(right));
}

test('Vite entry files keep the structural rules at both levels and in nested scopes', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"entry-sandbox","private":true,"type":"module"}',
        'src/start.js': STARTER,
        'src/main.js': START,
        'src/task.js': START,
        'api/src/start.js': STARTER,
        'api/src/main.js': START,
        'api/src/task.js': START,
    });
    expect(trivialFiles(await trivialFindings(sandbox.path, VITE_POLICY))).toStrictEqual(TRIVIAL_FILES);
    writeFileSync(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
    );
    for (const level of ['recommended', 'all']) {
        const policy = VITE_POLICY.replace('level = "all"', `level = "${level}"`).replace(
            '[tools.knip]',
            '[tools.eslint.rules]\n"gspot/no-trivial-functions" = [{maxStatements = 2}]\n"gspot/no-trivial-files" = [{maxStatements = 2}]\n[tools.knip]',
        );
        const findings = await trivialFindings(sandbox.path, policy);
        expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(
            level === 'all'
                ? [
                      { file: 'src/main.js', rule: 'gspot/no-trivial-files' },
                      { file: 'src/main.js', rule: 'gspot/no-trivial-functions' },
                  ]
                : [],
        );
        expect(trivialFiles(findings)).toStrictEqual(level === 'all' ? TRIVIAL_FILES : []);
        writeFileSync(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nexport function boot() { start(); }\n",
        );
        const publicFindings = await trivialFindings(sandbox.path, policy);
        expect(publicFindings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(
            level === 'all' ? [{ file: 'src/main.js', rule: 'gspot/no-trivial-files' }] : [],
        );
        writeFileSync(
            join(sandbox.path, 'src/main.js'),
            "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
        );
    }
});
