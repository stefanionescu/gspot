import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

import {
    OVERLAP_SCRIPT,
    OVERLAP_PROJECT,
    OVERLAP_FINDINGS,
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
