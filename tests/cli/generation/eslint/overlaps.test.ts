import { test, expect } from 'bun:test';
import { join, basename } from 'node:path';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import type { OverlapCase } from '#tests/types/cli/generation/eslint/overlaps.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

import {
    REGEX_PROJECT,
    REGEX_FINDINGS,
    REGEX_CORRECTION,
    REGEX_RULE_NAMES,
    REGEX_SEVERITIES,
} from '#tests/config/cli/generation/eslint/eslint-regex.ts';
import {
    DEPRECATION_PROJECT,
    DEPRECATION_FINDINGS,
    DEPRECATION_CORRECTION,
    DEPRECATION_RULE_NAMES,
    DEPRECATION_SEVERITIES,
} from '#tests/config/cli/generation/eslint/eslint-deprecation.ts';
import {
    BINDING_PROJECT,
    OVERLAP_PROJECT,
    BINDING_FINDINGS,
    BINDING_PATTERNS,
    OVERLAP_FINDINGS,
    OVERLAP_PATTERNS,
    EXECUTION_PROJECT,
    BINDING_RULE_NAMES,
    BINDING_SEVERITIES,
    EXECUTION_FINDINGS,
    OVERLAP_CORRECTION,
    OVERLAP_RULE_NAMES,
    OVERLAP_SEVERITIES,
} from '#tests/config/cli/generation/eslint/overlaps.ts';

const overlaps: OverlapCase[] = [
    {
        name: 'reports regex, catch and nested-condition defects once in JavaScript and TypeScript',
        project: OVERLAP_PROJECT,
        names: OVERLAP_RULE_NAMES,
        patterns: OVERLAP_PATTERNS,
        correction: OVERLAP_CORRECTION,
        expected: { configurations: { 'literal.js': OVERLAP_SEVERITIES, 'literal.ts': OVERLAP_SEVERITIES } },
        files: Object.entries(OVERLAP_FINDINGS).flatMap(([name, findings]) =>
            ['js', 'ts'].map((extension) => ({ file: `${name}.${extension}`, findings })),
        ),
        configuration: async (eslint, names) => {
            const configurations: Record<string, unknown> = {};
            for (const file of ['literal.js', 'literal.ts']) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configurations[file] = Object.fromEntries(names.map((name) => [name, config.rules[name]]));
            }
            return { configurations };
        },
    },
    {
        name: 'reports exponential and polynomial backtracking once and accepts safe repetition',
        project: REGEX_PROJECT,
        names: REGEX_RULE_NAMES,
        patterns: REGEX_FINDINGS.map(({ file }) => file),
        correction: REGEX_CORRECTION,
        expected: { severities: REGEX_SEVERITIES },
        files: REGEX_FINDINGS,
        configuration: async (eslint, names) => {
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('regex-exponential.js'));
            return { severities: names.map((name) => config.rules[name]![0]) };
        },
    },
    {
        name: 'reports deprecated TypeScript API uses once and accepts current overloads',
        project: DEPRECATION_PROJECT,
        names: DEPRECATION_RULE_NAMES,
        patterns: DEPRECATION_FINDINGS.map(({ file }) => file),
        correction: DEPRECATION_CORRECTION,
        expected: { severities: DEPRECATION_SEVERITIES },
        files: DEPRECATION_FINDINGS,
        configuration: async (eslint, names) => {
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile('deprecated.ts'));
            return { severities: names.map((name) => config.rules[name]![0]) };
        },
    },
    {
        name: 'gives unused bindings, dynamic execution and deprecated Buffer constructors one native owner',
        project: { ...BINDING_PROJECT, ...EXECUTION_PROJECT },
        names: BINDING_RULE_NAMES,
        patterns: BINDING_PATTERNS,
        correction: OVERLAP_CORRECTION,
        expected: {
            configurations: {
                'local.js': BINDING_SEVERITIES,
                'local.ts': { ...BINDING_SEVERITIES, 'no-unused-vars': 0, '@typescript-eslint/no-unused-vars': 2 },
            },
        },
        files: Object.entries({ ...BINDING_FINDINGS, ...EXECUTION_FINDINGS })
            .map(([file, findings]) => ({ file, findings }))
            .toSorted((left, right) => left.file.localeCompare(right.file)),
        configuration: async (eslint, names) => {
            const configurations: Record<string, unknown> = {};
            for (const file of ['local.js', 'local.ts']) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configurations[file] = Object.fromEntries(names.map((name) => [name, config.rules[name]?.[0] ?? null]));
            }
            return { configurations };
        },
    },
];

test.each(overlaps.flatMap((scenario) => (['recommended', 'all'] as const).map((level) => ({ ...scenario, level }))))(
    '$level $name',
    async ({ level, project, names, patterns, correction, expected, files, configuration }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...project, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        async function lintReport() {
            const configured = await configuration(eslint, names);
            const results = await eslint.lintFiles(patterns);
            return JSON.stringify({
                ...configured,
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
        expect(await lintReport()).toBe(JSON.stringify({ ...expected, files }));
        for (const { file } of files.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), correction);
        expect(await lintReport()).toBe(
            JSON.stringify({ ...expected, files: files.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(project).filter(
            ([file]) => !files.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);
