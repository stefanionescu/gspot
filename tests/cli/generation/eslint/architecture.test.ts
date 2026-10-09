import type { z } from 'zod';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { unlink } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { toolPin } from '#cli/configurations/contracts.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import type { toolProjectSchema } from '#cli/parsers/packages/contracts.ts';
import { createEslint, eslintConfigurationSchema } from '#tests/harness/generated.ts';

import {
    ROLE_TABLES,
    ROLE_TARGETS,
    ROLE_TSCONFIG,
    ENVIRONMENT_CASES,
    ROLE_IMPORT_CASES,
    ARCHITECTURE_CASES,
    ENVIRONMENT_TABLES,
    ARCHITECTURE_PROJECT,
    ENVIRONMENT_COMPOSED,
    ARCHITECTURE_POLICIES,
    ARCHITECTURE_CORRECTION,
} from '#tests/config/cli/generation/eslint/architecture.ts';

const boundaryVersion = toolPin(configurationManifests().values(), 'eslint-plugin-boundaries').version;
const importVersion = toolPin(configurationManifests().values(), 'eslint-import-resolver-typescript').version;

test.each(ARCHITECTURE_CASES)(
    '$level loads native architecture and role tools: $declarations',
    async ({ level, declarations }) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level, tables: ARCHITECTURE_POLICIES[declarations] });
        await createFileTree(sandbox.path, { ...ARCHITECTURE_PROJECT, 'gspot.toml': policy });
        const eslint = await createEslint(sandbox.path);
        const packages = (await Bun.file(join(sandbox.path, '.gspot/package.json')).json()) as z.infer<
            typeof toolProjectSchema
        >;
        const enabled = level === 'all' || declarations !== 'none';
        expect(packages.devDependencies['eslint-plugin-boundaries']).toBe(enabled ? boundaryVersion : undefined);
        expect(packages.devDependencies['eslint-import-resolver-typescript']).toBe(importVersion);
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
        const configured = [
            { plugin: enabled, classic: level === 'all' || declarations === 'root', modern: true },
            { plugin: enabled, classic: enabled, modern: true },
        ];
        const diagnostic = [{ ruleId: 'boundaries/dependencies', line: 1, column: 23, severity: 2 }];
        expect(await lintReport()).toBe(
            JSON.stringify({
                configured,
                findings: [declarations === 'root' ? diagnostic : [], declarations === 'scoped' ? diagnostic : []],
            }),
        );
        await Promise.all(
            ['app/source.ts', 'apps/api/app/source.ts'].map((file) =>
                Bun.write(join(sandbox.path, file), ARCHITECTURE_CORRECTION),
            ),
        );
        expect(await lintReport()).toBe(JSON.stringify({ configured, findings: [[], []] }));
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

test.each(['recommended', 'all'])('native role ownership respects %s scopes', async (level) => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['typescript'], { level, tables: ROLE_TABLES });
    await createFileTree(sandbox.path, {
        'gspot.toml': policy,
        'package.json': '{"private":true,"type":"module"}',
        'tsconfig.json': ROLE_TSCONFIG,
        'app/tsconfig.json': ROLE_TSCONFIG,
        ...Object.fromEntries(
            ['', 'app/'].flatMap((prefix) =>
                Object.entries(ROLE_TARGETS).map(([path, source]) => [prefix + path, source]),
            ),
        ),
    });
    const files = ['', 'app/'].flatMap((prefix) =>
        ROLE_IMPORT_CASES.map((row, index) => ({
            ...row,
            path: `${prefix}${row.folder}/case${String(index)}.ts`,
        })),
    );
    for (const row of files) await Bun.write(join(sandbox.path, row.path), row.source);
    const eslint = await createEslint(sandbox.path);
    for (const row of files) {
        const [result] = await eslint.lintFiles([row.path]);
        expect(result?.fatalErrorCount).toBe(0);
        const findings = result!.messages.filter(({ ruleId }) => ruleId === 'boundaries/dependencies');
        expect(findings).toHaveLength(level === 'all' && row.rejected ? 1 : 0);
    }
    expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
});

test.each(['recommended', 'all'])(
    'native environment ownership respects %s modules and project scopes',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['typescript'], { level, tables: ENVIRONMENT_TABLES });
        const paths = [
            'src/source.js',
            'config/env.js',
            'app/src/source.js',
            'app/src/env/source.js',
            'sibling/src/source.js',
            'app/deep/src/source.js',
            'literal/src/source.js',
            'literal/config/env.js',
            'empty/src/source.js',
        ];
        await createFileTree(sandbox.path, {
            'gspot.toml': policy,
            'package.json': '{"private":true,"type":"module"}',
            ...Object.fromEntries(paths.map((path) => [path, ''])),
            ...Object.fromEntries(
                ['', 'app/', 'sibling/', 'app/deep/', 'literal/', 'empty/'].map((prefix) => [
                    `${prefix}tsconfig.json`,
                    '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
                ]),
            ),
        });
        const eslint = await createEslint(sandbox.path);
        for (const path of paths) {
            const config = eslintConfigurationSchema.parse(await eslint.calculateConfigForFile(path));
            expect(config.rules['gspot/env-owner']).toBeUndefined();
            const rejected =
                level === 'all' &&
                !['config/env.js', 'app/src/env/source.js', 'literal/config/env.js', 'empty/src/source.js'].includes(
                    path,
                );
            for (const { source, rule } of ENVIRONMENT_CASES) {
                const [result] = await eslint.lintText(source, { filePath: path });
                expect(result?.fatalErrorCount).toBe(0);
                expect(result!.messages.filter(({ ruleId }) => ruleId === rule)).toHaveLength(rejected ? 1 : 0);
            }
            const [corrected] = await eslint.lintText('const port = "3000";\n', { filePath: path });
            expect(
                corrected!.messages.filter(({ ruleId }) => ENVIRONMENT_CASES.some(({ rule }) => rule === ruleId)),
            ).toStrictEqual([]);
        }
        const [composed] = await eslint.lintText(ENVIRONMENT_COMPOSED, { filePath: 'app/src/source.js' });
        expect(composed?.fatalErrorCount).toBe(0);
        expect(composed!.messages.filter(({ ruleId }) => ruleId === 'no-restricted-syntax')).toHaveLength(
            level === 'all' ? 2 : 0,
        );
        expect(await Bun.file(join(sandbox.path, 'gspot.toml')).text()).toBe(policy);
    },
);

test.each(['recommended', 'all'])('native %s environment rules stay absent without an owner', async (level) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level }),
        'package.json': '{"private":true,"type":"module"}',
        'src/source.js': '',
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["src/**/*.ts"]}',
    });
    const eslint = await createEslint(sandbox.path);
    for (const { source, rule } of ENVIRONMENT_CASES) {
        const [result] = await eslint.lintText(source, { filePath: 'src/source.js' });
        expect(result?.fatalErrorCount).toBe(0);
        expect(result!.messages.filter(({ ruleId }) => ruleId === rule)).toStrictEqual([]);
    }
});
