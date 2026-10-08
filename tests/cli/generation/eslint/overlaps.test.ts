import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';
import { REGEX_PROJECT, REGEX_FINDINGS, REGEX_CORRECTION } from '#tests/config/cli/generation/eslint/eslint-regex.ts';

import {
    DEPRECATION_PROJECT,
    DEPRECATION_FINDINGS,
    DEPRECATION_CORRECTION,
} from '#tests/config/cli/generation/eslint/eslint-deprecation.ts';
import {
    BINDING_PROJECT,
    OVERLAP_PROJECT,
    BINDING_FINDINGS,
    OVERLAP_FINDINGS,
    EXECUTION_PROJECT,
    BINDING_SEVERITIES,
    EXECUTION_FINDINGS,
    OVERLAP_CORRECTION,
    OVERLAP_SEVERITIES,
} from '#tests/config/cli/generation/eslint/overlaps.ts';

test.each(['recommended', 'all'] as const)(
    '%s reports regex, catch and nested-condition defects once in JavaScript and TypeScript',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...OVERLAP_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const configurations = { 'literal.js': OVERLAP_SEVERITIES, 'literal.ts': OVERLAP_SEVERITIES };
        const files = Object.entries(OVERLAP_FINDINGS).flatMap(([name, findings]) =>
            ['js', 'ts'].map((extension) => ({ file: `${name}.${extension}`, findings })),
        );
        async function lintReport() {
            const names = [
                'no-empty-character-class',
                'regexp/no-empty-character-class',
                'sonarjs/no-empty-character-class',
                'no-useless-catch',
                'sonarjs/no-useless-catch',
                'unicorn/no-lonely-if',
                'sonarjs/no-collapsible-if',
            ];
            const configurations: Record<string, unknown> = {};
            for (const file of ['literal.js', 'literal.ts']) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configurations[file] = Object.fromEntries(names.map((name) => [name, config.rules[name]]));
            }
            const results = await eslint.lintFiles(['*.js', '*.ts']);
            return JSON.stringify({
                configurations,
                files: results
                    .toSorted((left, right) => basename(left.filePath).localeCompare(basename(right.filePath)))
                    .map(({ filePath, messages }) => ({
                        file: basename(filePath),
                        findings: messages
                            .filter(({ ruleId, fatal }) => (ruleId !== null && names.includes(ruleId)) || fatal)
                            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                    })),
            });
        }
        const defect = await lintReport();
        expect(defect).toBe(JSON.stringify({ configurations, files }));
        for (const { file } of files.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), OVERLAP_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(
            JSON.stringify({ configurations, files: files.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(OVERLAP_PROJECT).filter(
            ([file]) => !files.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s reports exponential and polynomial backtracking once and accepts safe repetition',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...REGEX_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const severities = [2, 0, 0];
        async function lintReport() {
            const names = ['regexp/no-super-linear-backtracking', 'sonarjs/slow-regex', 'security/detect-unsafe-regex'];
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('regex-exponential.js'));
            const results = await eslint.lintFiles(
                [
                    'regex-exponential.js',
                    'regex-exponential.ts',
                    'regex-polynomial.js',
                    'regex-polynomial.ts',
                    'regex-safe.js',
                    'regex-safe.ts',
                    'regex-bounded.js',
                    'regex-bounded.ts',
                    'regex-constructor.js',
                    'regex-constructor.ts',
                    'regex-template.js',
                    'regex-template.ts',
                    'regex-unicode.js',
                    'regex-unicode.ts',
                ].toSorted((left, right) => left.localeCompare(right)),
            );
            return JSON.stringify({
                severities: names.map((name) => config.rules[name]![0]),
                files: results
                    .toSorted((left, right) => basename(left.filePath).localeCompare(basename(right.filePath)))
                    .map(({ filePath, messages }) => ({
                        file: basename(filePath),
                        findings: messages
                            .filter(({ ruleId, fatal }) => (ruleId !== null && names.includes(ruleId)) || fatal)
                            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                    })),
            });
        }
        const defect = await lintReport();
        expect(defect).toBe(JSON.stringify({ severities, files: REGEX_FINDINGS }));
        for (const { file } of REGEX_FINDINGS.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), REGEX_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(
            JSON.stringify({ severities, files: REGEX_FINDINGS.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(REGEX_PROJECT).filter(
            ([file]) => !REGEX_FINDINGS.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s reports deprecated TypeScript API uses once and accepts current overloads',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...DEPRECATION_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const severities = [2, 0];
        async function lintReport() {
            const names = ['@typescript-eslint/no-deprecated', 'sonarjs/deprecation'];
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('deprecated.ts'));
            const results = await eslint.lintFiles(
                [
                    'api.ts',
                    'deprecated.ts',
                    'type-reference.ts',
                    'overload-deprecated.ts',
                    'overload-current.ts',
                    'current.ts',
                ].toSorted((left, right) => left.localeCompare(right)),
            );
            return JSON.stringify({
                severities: names.map((name) => config.rules[name]![0]),
                files: results
                    .toSorted((left, right) => basename(left.filePath).localeCompare(basename(right.filePath)))
                    .map(({ filePath, messages }) => ({
                        file: basename(filePath),
                        findings: messages
                            .filter(({ ruleId, fatal }) => (ruleId !== null && names.includes(ruleId)) || fatal)
                            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                    })),
            });
        }
        const defect = await lintReport();
        expect(defect).toBe(JSON.stringify({ severities, files: DEPRECATION_FINDINGS }));
        for (const { file } of DEPRECATION_FINDINGS.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), DEPRECATION_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(
            JSON.stringify({ severities, files: DEPRECATION_FINDINGS.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(DEPRECATION_PROJECT).filter(
            ([file]) => !DEPRECATION_FINDINGS.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);

test.each(['recommended', 'all'] as const)(
    '%s gives unused bindings, dynamic execution and deprecated Buffer constructors one native owner',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        const project = { ...BINDING_PROJECT, ...EXECUTION_PROJECT };
        await createFileTree(sandbox.path, { ...project, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const configurations = {
            'local.js': BINDING_SEVERITIES,
            'local.ts': { ...BINDING_SEVERITIES, 'no-unused-vars': 0, '@typescript-eslint/no-unused-vars': 2 },
        };
        const files = Object.entries({ ...BINDING_FINDINGS, ...EXECUTION_FINDINGS })
            .map(([file, findings]) => ({ file, findings }))
            .toSorted((left, right) => left.file.localeCompare(right.file));
        async function lintReport() {
            const names = [
                'no-unused-vars',
                '@typescript-eslint/no-unused-vars',
                'sonarjs/no-unused-vars',
                'sonarjs/unused-import',
                'security/detect-eval-with-expression',
                'sonarjs/code-eval',
                'security/detect-new-buffer',
                'n/no-deprecated-api',
            ];
            const configurations: Record<string, unknown> = {};
            for (const file of ['local.js', 'local.ts']) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configurations[file] = Object.fromEntries(names.map((name) => [name, config.rules[name]?.[0] ?? null]));
            }
            const results = await eslint.lintFiles(['*.js', '*.ts', '*.cjs', '*.cts']);
            return JSON.stringify({
                configurations,
                files: results
                    .toSorted((left, right) => basename(left.filePath).localeCompare(basename(right.filePath)))
                    .map(({ filePath, messages }) => ({
                        file: basename(filePath),
                        findings: messages
                            .filter(({ ruleId, fatal }) => (ruleId !== null && names.includes(ruleId)) || fatal)
                            .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                    })),
            });
        }
        const defect = await lintReport();
        expect(defect).toBe(JSON.stringify({ configurations, files }));
        for (const { file } of files.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), OVERLAP_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(
            JSON.stringify({ configurations, files: files.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(project).filter(
            ([file]) => !files.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);
