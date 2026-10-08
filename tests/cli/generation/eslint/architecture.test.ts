import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolProjectSchema } from '#cli/parsers/schema/packages.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

import {
    ARCHITECTURE_CASES,
    ARCHITECTURE_PROJECT,
    ARCHITECTURE_POLICIES,
    ARCHITECTURE_CORRECTION,
} from '#tests/config/cli/generation/eslint/architecture.ts';

test.each(ARCHITECTURE_CASES)(
    '$level loads architecture tools only for declared modules: $declarations',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level, tables: ARCHITECTURE_POLICIES[declarations] });
        await createFileTree(sandbox.path, { ...ARCHITECTURE_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const packages = toolProjectSchema.parse(await Bun.file(join(sandbox.path, '.gspot/package.json')).json());
        const enabled = declarations !== 'none';
        expect(packages.devDependencies['eslint-plugin-boundaries']).toBe(enabled ? '7.2.0' : undefined);
        expect(packages.devDependencies['eslint-import-resolver-typescript']).toBe('4.4.5');
        if (!enabled) await unlink(join(sandbox.path, 'node_modules/eslint-plugin-boundaries'));
        async function lintReport() {
            const files = ['app/source.ts', 'apps/api/app/source.ts'];
            const configured = [];
            for (const file of files) {
                const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(file));
                configured.push({
                    plugin: Object.hasOwn(config.plugins, 'boundaries'),
                    classic: Object.hasOwn(config.settings, 'import/resolver'),
                    modern: Object.hasOwn(config.settings, 'import-x/resolver-next'),
                });
            }
            const results = await eslint.lintFiles(files);
            return JSON.stringify({
                configured,
                findings: results.map(({ messages }) =>
                    messages
                        .filter(({ ruleId, fatal }) => ruleId === 'boundaries/dependencies' || fatal)
                        .map(({ ruleId, line, column, severity }) => ({ ruleId, line, column, severity })),
                ),
            });
        }
        const linted = await lintReport();
        const configured = [
            { plugin: enabled, classic: declarations === 'root', modern: true },
            { plugin: enabled, classic: enabled, modern: true },
        ];
        const diagnostic = [{ ruleId: 'boundaries/dependencies', line: 1, column: 23, severity: 2 }];
        expect(linted).toBe(
            JSON.stringify({
                configured,
                findings: [declarations === 'root' ? diagnostic : [], declarations === 'scoped' ? diagnostic : []],
            }),
        );
        for (const file of ['app/source.ts', 'apps/api/app/source.ts'])
            await Bun.write(join(sandbox.path, file), ARCHITECTURE_CORRECTION);
        const corrected = await lintReport();
        expect(corrected).toBe(JSON.stringify({ configured, findings: [[], []] }));
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
