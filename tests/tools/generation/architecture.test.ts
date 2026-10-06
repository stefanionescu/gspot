import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { createEslint } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { toolProjectSchema } from '#cli/parsers/schema/packages.ts';
import type { ArchitectureToolCase } from '#tests/types/generation/configuration-files.ts';

import {
    ARCHITECTURE_CASES,
    ARCHITECTURE_SCRIPT,
    ARCHITECTURE_PROJECT,
    ARCHITECTURE_POLICIES,
    ARCHITECTURE_CORRECTION,
} from '#tests/config/tools/generation/architecture.ts';

test.each(ARCHITECTURE_CASES)(
    '$level loads architecture tools only for declared modules: $declarations',
    async ({ level, declarations }: ArchitectureToolCase) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level, tables: ARCHITECTURE_POLICIES[declarations] });
        await createFileTree(sandbox.path, { ...ARCHITECTURE_PROJECT, 'gspot.toml': policy });
        await createEslint(sandbox.path);
        const packages = toolProjectSchema.parse(await Bun.file(join(sandbox.path, '.gspot/package.json')).json());
        const enabled = declarations !== 'none';
        expect(packages.devDependencies['eslint-plugin-boundaries']).toBe(enabled ? '7.2.0' : undefined);
        expect(packages.devDependencies['eslint-import-resolver-typescript']).toBe('4.4.5');
        if (!enabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        const linted = await runTestCommand(['node', '--input-type=module', '-e', ARCHITECTURE_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(linted.code, linted.stdout + linted.stderr).toBe(0);
        const configured = Array.from({ length: 2 }, () => ({ plugin: enabled, classic: enabled, modern: true }));
        const diagnostic = [{ ruleId: 'boundaries/dependencies', line: 1, column: 23, severity: 2 }];
        expect(linted.stdout).toBe(
            JSON.stringify({
                configured,
                findings: [declarations === 'root' ? diagnostic : [], declarations === 'scoped' ? diagnostic : []],
            }),
        );
        for (const file of ['app/source.ts', 'apps/api/app/source.ts'])
            await Bun.write(join(sandbox.path, file), ARCHITECTURE_CORRECTION);
        const corrected = await runTestCommand(['node', '--input-type=module', '-e', ARCHITECTURE_SCRIPT], {
            cwd: sandbox.path,
        });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(corrected.stdout).toBe(JSON.stringify({ configured, findings: [[], []] }));
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
        for (const file of [
            'package.json',
            'tsconfig.json',
            'apps/api/tsconfig.json',
            'storage/value.ts',
            'apps/api/storage/value.ts',
        ] as const)
            expect(await Bun.file(join(sandbox.path, file)).text()).toBe(ARCHITECTURE_PROJECT[file]);
    },
);
