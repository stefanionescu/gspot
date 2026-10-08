import { ESLint } from 'eslint';
import { test, expect } from 'bun:test';
import { join, relative } from 'node:path';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { parseOutput } from '#cli/parsers/output/parse.ts';
import { eslintFilePatterns } from '#cli/generation/eslint/serialize.ts';
import { configurationManifests } from '#cli/configurations/manifests.ts';

import {
    NODE_SCRIPT_CASES,
    NODE_SCRIPT_FILES,
    NODE_SCRIPT_RULES,
    NODE_SCRIPT_SOURCE,
    NODE_SCRIPT_TABLES,
    NODE_CONTRACT_RULES,
    NODE_SCRIPT_CONTROLS,
    NODE_SCRIPT_CONTRACTS,
    NODE_SCRIPT_CORRECTED,
    NODE_SCRIPT_NATIVE_ROOTS,
} from '#tests/config/cli/generation/eslint/node-scripts.ts';

async function nodeFindings(eslint: ESLint, root: string, paths: string[], rules: string[]) {
    const results = await eslint.lintFiles(paths);
    return results.map(({ filePath, messages }) => ({
        file: toPosix(relative(root, filePath)),
        findings: messages
            .filter(({ ruleId, fatal }) => fatal || ruleId === null || rules.includes(ruleId))
            .map(({ ruleId, line, severity }) => ({ ruleId, line, severity }))
            .toSorted((left, right) => (left.ruleId ?? '').localeCompare(right.ruleId ?? '') || left.line - right.line),
    }));
}

test.each(['recommended', 'all'] as const)(
    '%s native ESLint checks tagged Node files and retains typed and excluded file ownership',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
        });
        const eslint = await createEslint(sandbox.path);
        const paths = NODE_SCRIPT_CASES.map(({ file }) => file);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const { file, corrected } of NODE_SCRIPT_CASES)
                    await Bun.write(join(sandbox.path, file), corrected);
            const configurations = await Promise.all(
                NODE_SCRIPT_CONTROLS.map(async (file) => ({
                    file,
                    matched: (await eslint.calculateConfigForFile(file)) !== undefined,
                })),
            );
            const native = {
                results: await nodeFindings(eslint, sandbox.path, paths, NODE_SCRIPT_RULES),
                configurations,
            };
            expect(JSON.stringify(native)).toBe(
                JSON.stringify({
                    results: NODE_SCRIPT_CASES.map(({ file, unused, strict }) => ({
                        file,
                        findings: corrected ? [] : [unused, ...(level === 'all' ? strict : [])],
                    })),
                    configurations: NODE_SCRIPT_CONTROLS.map((file) => ({ file, matched: false })),
                }),
            );
        }
        for (const file of NODE_SCRIPT_CONTROLS)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(NODE_SCRIPT_FILES[file]);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s native extensionless Node contracts report syntax, runtime, imports and scoped structural limits',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...NODE_SCRIPT_FILES,
            'gspot.toml': buildPolicy(['typescript'], { level, tables: NODE_SCRIPT_TABLES }),
            ...Object.fromEntries(NODE_SCRIPT_CONTRACTS.map(({ file, source }) => [file, source])),
            'source.js': 'export const value = 1;\n',
        });
        const eslint = await createEslint(sandbox.path);
        for (const corrected of [false, true]) {
            if (corrected)
                for (const contract of NODE_SCRIPT_CONTRACTS)
                    await Bun.write(join(sandbox.path, contract.file), contract.corrected);
            const paths = NODE_SCRIPT_CONTRACTS.map(({ file }) => file);
            const native = await nodeFindings(eslint, sandbox.path, paths, NODE_CONTRACT_RULES);
            expect(JSON.stringify(native)).toBe(
                JSON.stringify(
                    NODE_SCRIPT_CONTRACTS.map(({ file, routine, strict }) => ({
                        file,
                        findings: corrected ? [] : [...routine, ...(level === 'all' ? strict : [])],
                    })),
                ),
            );
        }
    },
);

test.skipIf(process.platform === 'win32').each(NODE_SCRIPT_NATIVE_ROOTS)(
    'native Node glob and output boundaries retain POSIX filenames in %s',
    async (directory) => {
        await using sandbox = await testdir();
        const root = join(sandbox.path, directory);
        const file = String.raw`scripts/run\name`;
        const control = 'scripts/runname';
        await createFileTree(root, {
            'package.json': '{"private":true,"type":"module"}',
            [file]: NODE_SCRIPT_SOURCE,
            [control]: '#!/usr/bin/env bash\necho ready\n',
        });
        const eslint = new ESLint({
            cwd: root,
            overrideConfigFile: true,
            overrideConfig: [
                {
                    files: eslintFilePatterns({ components: [], tests: [], scripts: [], nodeFiles: [file] }).code,
                    rules: { 'no-unused-vars': 'error' },
                },
            ],
        });
        expect(await eslint.calculateConfigForFile(control)).toBeUndefined();
        const check = configurationManifests()
            .get('javascript')!
            .checks.find(({ name }) => name === 'javascript/eslint')!;
        for (const corrected of [false, true]) {
            if (corrected) await Bun.write(join(root, file), NODE_SCRIPT_CORRECTED);
            const results = await eslint.lintFiles([file]);
            const findings = parseOutput(check, JSON.stringify(results), '', { root, cwd: root });
            expect(findings).toStrictEqual(
                corrected
                    ? []
                    : [
                          {
                              check: check.name,
                              file,
                              line: 2,
                              column: 7,
                              rule: 'no-unused-vars',
                              message: "'unused' is assigned a value but never used.",
                              help: check.help,
                              fixable: false,
                          },
                      ],
            );
        }
        expect(await Bun.file(join(root, control)).text()).toBe('#!/usr/bin/env bash\necho ready\n');
    },
);
