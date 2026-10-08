import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { emitFile } from '#tests/harness/generated.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { parseOutput } from '#cli/parsers/output/public.ts';
import { linkInstalledModules } from '#tests/harness/platforms.ts';
import { configurationManifests } from '#cli/configurations/public.ts';

import {
    KNIP_ENTRY_TABLES,
    KNIP_UNUSED_FILES,
    KNIP_POINTER_FILES,
    KNIP_BINARY_PACKAGE,
    KNIP_POINTER_TABLES,
    KNIP_COMPONENT_FILES,
    KNIP_DIAGNOSTIC_FILES,
    KNIP_DEPENDENCY_PACKAGE,
} from '#tests/config/cli/generation/knip.ts';

const check = configurationManifests()
    .get('javascript')!
    .checks.find(({ name }) => name === 'javascript/knip')!;

test.each(['recommended', 'all'] as const)(
    '%s Knip retains native component defaults and scoped entry points',
    async (level) => {
        await using sandbox = await testdir();
        const policy = buildPolicy(['javascript'], { level, tables: KNIP_ENTRY_TABLES });
        const configuration = await emitFile(policy, '.gspot/config/knip.json', KNIP_COMPONENT_FILES);
        await createFileTree(sandbox.path, { ...KNIP_COMPONENT_FILES, '.gspot/config/knip.json': configuration });
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [
            'node',
            '.gspot/node_modules/knip/bin/knip.js',
            '--config',
            '.gspot/config/knip.json',
            '--no-progress',
            '--reporter',
            'json',
            '--include',
            'files',
        ];
        const native = await runTestCommand(command, { cwd: sandbox.path });
        expect(native.code, native.stdout + native.stderr).toBe(1);
        const findings = parseOutput(check, native.stdout, native.stderr, { root: sandbox.path, cwd: sandbox.path });
        expect(findings.toSorted((left, right) => left.file.localeCompare(right.file))).toStrictEqual(
            KNIP_UNUSED_FILES.map((file) => ({
                check: check.name,
                file,
                rule: 'files',
                message: `Unused file: ${file}`,
                help: check.help,
                fixable: false,
            })),
        );
        for (const file of KNIP_UNUSED_FILES) await Bun.file(join(sandbox.path, file)).delete();
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
        ).toStrictEqual([]);
    },
);

test('Knip owns global binary exclusions and still reports an unlisted command', async () => {
    await using sandbox = await testdir();
    const files = { 'package.json': KNIP_BINARY_PACKAGE, 'main.js': 'export const value = 1;\n' };
    const configuration = await emitFile(buildPolicy(['javascript']), '.gspot/config/knip.json', files);
    await createFileTree(sandbox.path, { ...files, '.gspot/config/knip.json': configuration });
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const native = await runTestCommand(
        [
            'node',
            '.gspot/node_modules/knip/bin/knip.js',
            '--config',
            '.gspot/config/knip.json',
            '--no-progress',
            '--reporter',
            'json',
            '--include',
            'binaries',
        ],
        { cwd: sandbox.path },
    );
    expect(native.code, native.stdout + native.stderr).toBe(1);
    expect(parseOutput(check, native.stdout, native.stderr, { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([
        {
            check: check.name,
            file: 'package.json',
            rule: 'binaries',
            message: 'Unlisted binary: missing-native-tool',
            help: check.help,
            fixable: false,
        },
    ]);
});

test.each(['recommended', 'all'] as const)(
    '%s Knip ignores selected tool packages and reports unused project dependencies',
    async (level) => {
        await using sandbox = await testdir();
        const files = { 'package.json': KNIP_DEPENDENCY_PACKAGE, 'main.js': 'export const value = 1;\n' };
        const configuration = await emitFile(buildPolicy(['javascript'], { level }), '.gspot/config/knip.json', files);
        await createFileTree(sandbox.path, { ...files, '.gspot/config/knip.json': configuration });
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const command = [
            'node',
            '.gspot/node_modules/knip/bin/knip.js',
            '--config',
            '.gspot/config/knip.json',
            '--no-progress',
            '--reporter',
            'json',
            '--include',
            'dependencies',
        ];
        const native = await runTestCommand(command, { cwd: sandbox.path });
        expect(native.code, native.stdout + native.stderr).toBe(1);
        const findings = parseOutput(check, native.stdout, native.stderr, { root: sandbox.path, cwd: sandbox.path });
        expect(findings.toSorted((left, right) => left.message.localeCompare(right.message))).toStrictEqual([
            {
                check: check.name,
                file: 'package.json',
                rule: 'dependencies',
                message: 'Unused dependency: fixture-unused-package',
                help: check.help,
                fixable: false,
            },
            {
                check: check.name,
                file: 'package.json',
                rule: 'dependencies',
                message: 'Unused dependency: vale',
                help: check.help,
                fixable: false,
            },
        ]);
        await Bun.write(join(sandbox.path, 'package.json'), '{"name":"native-project","private":true,"type":"module"}');
        const corrected = await runTestCommand(command, { cwd: sandbox.path });
        expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
        expect(
            parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
        ).toStrictEqual([]);
    },
);

test('native Knip distinguishes positioned unused exports from an unlisted dependency in a spaced filename', async () => {
    await using sandbox = await testdir();
    const policy = buildPolicy(['javascript'], { tables: '[tools.knip]\nentry = ["main.js"]\n' });
    const configuration = await emitFile(policy, '.gspot/config/knip.json', KNIP_DIAGNOSTIC_FILES);
    await createFileTree(sandbox.path, { ...KNIP_DIAGNOSTIC_FILES, '.gspot/config/knip.json': configuration });
    await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
    const command = [
        'node',
        '.gspot/node_modules/knip/bin/knip.js',
        '--config',
        '.gspot/config/knip.json',
        '--no-progress',
        '--reporter',
        'json',
        '--include',
        'exports,unlisted',
    ];
    const native = await runTestCommand(command, { cwd: sandbox.path });
    expect(native.code, native.stdout + native.stderr).toBe(1);
    expect(parseOutput(check, native.stdout, native.stderr, { root: sandbox.path, cwd: sandbox.path })).toStrictEqual([
        {
            check: check.name,
            file: 'space source.js',
            rule: 'exports',
            message: 'Unused export: unused',
            line: 3,
            column: 14,
            help: check.help,
            fixable: false,
        },
        {
            check: check.name,
            file: 'space source.js',
            rule: 'exports',
            message: 'Unused export: alias',
            line: 4,
            column: 18,
            help: check.help,
            fixable: false,
        },
        {
            check: check.name,
            file: 'space source.js',
            rule: 'unlisted',
            message: 'Unlisted dependency: fixture-missing-package',
            line: 1,
            column: 8,
            help: check.help,
            fixable: false,
        },
    ]);
    await Bun.write(join(sandbox.path, 'space source.js'), 'export const used = 1;\n');
    const corrected = await runTestCommand(command, { cwd: sandbox.path });
    expect(corrected.code, corrected.stdout + corrected.stderr).toBe(0);
    expect(
        parseOutput(check, corrected.stdout, corrected.stderr, { root: sandbox.path, cwd: sandbox.path }),
    ).toStrictEqual([]);
});

test.each(['recommended', 'all'] as const)(
    '%s Knip ignores selected root and child pointers while reporting undeclared configuration-shaped source',
    async (level) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            ...KNIP_POINTER_FILES,
            'gspot.toml': buildPolicy(['javascript', 'markdown'], { level, tables: KNIP_POINTER_TABLES }),
        });
        const session = await openSession(sandbox.path);
        const generated = emitAll(session).files;
        const pointers = generated.filter(({ kind }) => kind === 'pointer');
        const configuration = generated.find(({ path }) => path === '.gspot/config/knip.json')!;
        for (const path of ['eslint.config.mjs', '.markdownlint-cli2.mjs', 'child/.markdownlint-cli2.mjs'])
            expect(
                pointers.some((pointer) => pointer.path === path),
                path,
            ).toBe(true);
        await createFileTree(
            sandbox.path,
            Object.fromEntries([configuration, ...pointers].map(({ path, content }) => [path, content])),
        );
        await linkInstalledModules(join(sandbox.path, '.gspot/node_modules'));
        const native = await runTestCommand(
            [
                'node',
                '.gspot/node_modules/knip/bin/knip.js',
                '--config',
                configuration.path,
                '--no-progress',
                '--reporter',
                'json',
                '--include',
                'files',
            ],
            { cwd: sandbox.path },
        );
        expect(native.code, native.stdout + native.stderr).toBe(1);
        expect(
            parseOutput(check, native.stdout, native.stderr, { root: sandbox.path, cwd: sandbox.path })
                .map(({ file }) => file)
                .toSorted((left, right) => left.localeCompare(right)),
        ).toStrictEqual(['child/eslint.config.js', 'eslint.config.js']);
    },
);
