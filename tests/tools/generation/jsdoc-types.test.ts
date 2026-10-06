import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';

import {
    JSDOC_RULES,
    JSDOC_SCRIPT,
    JSDOC_PROJECT,
    JSDOC_FINDINGS,
    JSDOC_CORRECTION,
} from '#tests/config/tools/generation/jsdoc-types.ts';

test.each(['recommended', 'all'] as const)(
    '%s requires valid JavaScript type documentation and keeps TypeScript type tags disabled',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level });
        await createFileTree(sandbox.path, { ...JSDOC_PROJECT, 'gspot.toml': policy });
        await createEslint(sandbox.path);
        const settings = {
            'missing.js': Object.fromEntries(JSDOC_RULES.map((name) => [name, [2]])),
            'typed.ts': Object.fromEntries(JSDOC_RULES.map((name) => [name, [0]])),
        };
        const linted = await runTestCommand(['node', '--input-type=module', '-e', JSDOC_SCRIPT], { cwd: sandbox.path });
        expect(linted.code, linted.stdout + linted.stderr).toBe(0);
        expect(linted.stdout).toBe(JSON.stringify({ configurations: settings, files: JSDOC_FINDINGS }));
        const compiler = [
            'node',
            'node_modules/typescript/lib/tsc.js',
            '--project',
            '.gspot/config/jsconfig.json',
            '--pretty',
            'false',
        ];
        const defect = await runTestCommand(compiler, { cwd: sandbox.path });
        expect(defect.code, defect.stdout + defect.stderr).toBe(2);
        expect(defect.stderr).toBe('');
        expect(defect.stdout).toBe(
            "malformed.js(3,19): error TS1005: ']' expected.\nmissing.js(6,25): error TS7006: Parameter 'value' implicitly has an 'any' type.\nundefined.js(3,12): error TS2304: Cannot find name 'MissingType'.\n",
        );
        for (const { file } of JSDOC_FINDINGS.filter((entry) => entry.file.endsWith('.js')))
            await Bun.write(join(sandbox.path, file), JSDOC_CORRECTION);
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', JSDOC_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(
            JSON.stringify({
                configurations: settings,
                files: JSDOC_FINDINGS.map(({ file }) => ({ file, findings: [] })),
            }),
        );
        const compiled = await runTestCommand(compiler, { cwd: sandbox.path });
        expect(compiled.code, compiled.stdout + compiled.stderr).toBe(0);
        expect(compiled.stdout + compiled.stderr).toBe('');
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const file of ['package.json', 'jsconfig.json', 'tsconfig.json', 'typed.ts'] as const)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(JSDOC_PROJECT[file]);
    },
);
