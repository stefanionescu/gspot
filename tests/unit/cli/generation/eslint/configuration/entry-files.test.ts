import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { LEVELS } from '#cli/config/configurations.ts';
import type { LintFinding } from '#tests/types/tool-output.ts';
import { createEslint, lintFindings } from '#tests/setup/generate.ts';

import {
    ENTRY_SOURCE,
    ENTRY_FOLDERS,
    TRIVIAL_RULES,
    STARTER_SOURCE,
    ENTRY_SETTINGS,
    TRIVIAL_ENTRY_SOURCES,
} from '#tests/config/eslint/structure.ts';

// The files and rules the generated configuration reports among the two rules about trivial code.
async function trivialFindings(root: string, settings: string): Promise<Pick<LintFinding, 'file' | 'rule'>[]> {
    await writeFile(join(root, 'gspot.toml'), settings);
    const eslint = await createEslint(root);
    const awaitedFindings = await lintFindings(eslint, root, ENTRY_FOLDERS, TRIVIAL_RULES);
    return awaitedFindings.map(({ file, rule }) => ({ file, rule }));
}

// The files the trivial-file rule reports, sorted.
function trivialFiles(findings: Pick<LintFinding, 'file' | 'rule'>[]): string[] {
    const files = findings.filter(({ rule }) => rule === 'gspot/no-trivial-files').map(({ file }) => file);
    return [...new Set(files)].toSorted((left, right) => left.localeCompare(right));
}

test.each([...LEVELS])('Knip entry files still get the trivial-file rules at %s, in nested scopes', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': '{"name":"entry-sandbox","private":true,"type":"module"}',
        'src/start.js': STARTER_SOURCE,
        'src/main.js': ENTRY_SOURCE,
        'src/task.js': ENTRY_SOURCE,
        'api/src/start.js': STARTER_SOURCE,
        'api/src/main.js': ENTRY_SOURCE,
        'api/src/task.js': ENTRY_SOURCE,
    });
    expect(trivialFiles(await trivialFindings(sandbox.path, ENTRY_SETTINGS))).toStrictEqual([...TRIVIAL_ENTRY_SOURCES]);
    await writeFile(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nfunction boot() { start(); }\nboot();\n",
    );
    const settings = ENTRY_SETTINGS.replace('level = "all"', `level = "${level}"`).replace(
        '[tools.knip]',
        '[tools.eslint.rules]\n"gspot/no-trivial-functions" = [{trivialStatements = 2}]\n"gspot/no-trivial-files" = [{trivialStatements = 2}]\n[tools.knip]',
    );
    const findings = await trivialFindings(sandbox.path, settings);
    expect(findings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(
        level === 'all'
            ? [
                  { file: 'src/main.js', rule: 'gspot/no-trivial-files' },
                  { file: 'src/main.js', rule: 'gspot/no-trivial-functions' },
              ]
            : [],
    );
    expect(trivialFiles(findings)).toStrictEqual(level === 'all' ? [...TRIVIAL_ENTRY_SOURCES] : []);
    await writeFile(
        join(sandbox.path, 'src/main.js'),
        "import { start } from './start.js';\nexport function boot() { start(); }\n",
    );
    const publicFindings = await trivialFindings(sandbox.path, settings);
    expect(publicFindings.filter(({ file }) => file === 'src/main.js')).toStrictEqual(
        level === 'all' ? [{ file: 'src/main.js', rule: 'gspot/no-trivial-files' }] : [],
    );
});
