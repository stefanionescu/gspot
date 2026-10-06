import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

import {
    BINDING_SCRIPT,
    OVERLAP_SCRIPT,
    BINDING_PROJECT,
    OVERLAP_PROJECT,
    BINDING_FINDINGS,
    OVERLAP_FINDINGS,
    EXECUTION_PROJECT,
    BINDING_SEVERITIES,
    EXECUTION_FINDINGS,
    OVERLAP_CORRECTION,
    OVERLAP_SEVERITIES,
} from '#tests/config/tools/generation/eslint-overlaps.ts';

test.each(['recommended', 'all'] as const)(
    '%s reports regex, catch and nested-condition defects once in JavaScript and TypeScript',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...OVERLAP_PROJECT, 'gspot.toml': policy });
        await createEslint(sandbox.path);
        const configurations = { 'literal.js': OVERLAP_SEVERITIES, 'literal.ts': OVERLAP_SEVERITIES };
        const files = Object.entries(OVERLAP_FINDINGS).flatMap(([name, findings]) =>
            ['js', 'ts'].map((extension) => ({ file: `${name}.${extension}`, findings })),
        );
        const defect = await runTestCommand(['node', '--input-type=module', '-e', OVERLAP_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(defect.code, defect.stdout + defect.stderr).toBe(0);
        expect(defect.stdout).toBe(JSON.stringify({ configurations, files }));
        for (const { file } of files.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), OVERLAP_CORRECTION);
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', OVERLAP_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(
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
    '%s gives unused bindings, dynamic execution and deprecated Buffer constructors one native owner',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        const project = { ...BINDING_PROJECT, ...EXECUTION_PROJECT };
        await createFileTree(sandbox.path, { ...project, 'gspot.toml': policy });
        await createEslint(sandbox.path);
        const configurations = {
            'local.js': BINDING_SEVERITIES,
            'local.ts': { ...BINDING_SEVERITIES, 'no-unused-vars': 0, '@typescript-eslint/no-unused-vars': 2 },
        };
        const files = Object.entries({ ...BINDING_FINDINGS, ...EXECUTION_FINDINGS })
            .map(([file, findings]) => ({ file, findings }))
            .toSorted((left, right) => left.file.localeCompare(right.file));
        const defect = await runTestCommand(['node', '--input-type=module', '-e', BINDING_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(defect.code, defect.stdout + defect.stderr).toBe(0);
        expect(defect.stdout).toBe(JSON.stringify({ configurations, files }));
        for (const { file } of files.filter((entry) => entry.findings.length > 0))
            await Bun.write(join(sandbox.path, file), OVERLAP_CORRECTION);
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', BINDING_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(
            JSON.stringify({ configurations, files: files.map(({ file }) => ({ file, findings: [] })) }),
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const [file, source] of Object.entries(project).filter(
            ([file]) => !files.some((entry) => entry.file === file && entry.findings.length > 0),
        ))
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(source);
    },
);
