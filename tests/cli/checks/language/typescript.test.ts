import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { planRun } from '#cli/planning/public.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { toPosix } from '#cli/platform/contracts.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { checkjs } from '#cli/checks/language/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { VALID } from '#tests/config/samples/typescript.ts';
import { openSession, applyCommand } from '#cli/commands/public.ts';

const TSCONFIG_OPTIONS_POLICY = buildPolicy(['typescript']);

test('malformed TypeScript configuration reports its path instead of missing options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY, 'tsconfig.json': '{' });
    const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
    expect(() => BUILT_IN_CHECKS['typescript/tsconfig'].input(input)).toThrow(
        `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
    );
    await writeFile(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
});

test('a missing inherited configuration cannot be replaced by empty compiler options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TSCONFIG_OPTIONS_POLICY,
        'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
    // TypeScript prints the inherited path with forward slashes on every platform.
    expect(() => BUILT_IN_CHECKS['typescript/tsconfig'].input(input)).toThrow(
        `Cannot read file '${toPosix(join(sandbox.path, 'missing.json'))}'`,
    );
    await writeFile(join(sandbox.path, 'missing.json'), VALID);
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
});

test('a standalone scope needs no authored tsconfig but still audits an added project configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY });
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), VALID.replace('"strict":true', '"strict":false'));
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([
        {
            check: 'typescript/tsconfig',
            file: 'tsconfig.json',
            rule: 'strict',
            fixable: false,
            message: 'strict is not on in this tsconfig.',
            help: 'Enable this compiler option in the authored TypeScript configuration.',
        },
    ]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
});

test('nested configurations inherit the configuration an ancestor package names', async () => {
    const filename = 'strict.json';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TSCONFIG_OPTIONS_POLICY,
        'tsconfig.json': '{"extends":"./apps/web/tsconfig.json"}',
        'apps/web/tsconfig.json': '{"extends":"@example/config"}',
        'node_modules/@example/config/package.json': JSON.stringify({
            name: '@example/config',
            tsconfig: filename,
        }),
        [`node_modules/@example/config/${filename}`]: '{"compilerOptions":{"strict":true}}',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
    const inherited = BUILT_IN_CHECKS['typescript/tsconfig'].input(input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    expect(BUILT_IN_CHECKS['typescript/tsconfig'].input(input)).toStrictEqual(inherited);
    const overridden = BUILT_IN_CHECKS['typescript/tsconfig'].input(
        buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
    );
    expect(
        overridden
            .filter((finding) => finding.rule === 'strict')
            .map(({ check, file, rule }) => ({ check, file, rule })),
    ).toStrictEqual([
        { check: 'typescript/tsconfig', file: 'tsconfig.json', rule: 'strict' },
        { check: 'typescript/tsconfig', file: 'apps/web/tsconfig.json', rule: 'strict' },
    ]);
});

test('recommended permits the two compiler options that all requires', async () => {
    await using sandbox = await testdir();
    const options = {
        compilerOptions: {
            strict: true,
            noUncheckedIndexedAccess: true,
            exactOptionalPropertyTypes: true,
            noImplicitOverride: true,
            noFallthroughCasesInSwitch: true,
        },
    };
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'recommended' }),
        'tsconfig.json': JSON.stringify(options),
    });
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy(['typescript'], { level: 'all' }));
    const findings = BUILT_IN_CHECKS['typescript/tsconfig'].input(
        buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
    );
    expect(findings).toHaveLength(2);
    expect(new Set(findings.map(({ rule }) => rule))).toStrictEqual(
        new Set(['noImplicitReturns', 'noPropertyAccessFromIndexSignature']),
    );
    await writeFile(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(
        BUILT_IN_CHECKS['typescript/tsconfig'].input(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
});

test('a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['javascript'], {
            tables: '[agent_rules]\nenabled = false\n[scope."site"]\nconfigurations = ["javascript"]\n',
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = emitAll(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/config/jsconfig.json']);
    const applied = await applyCommand({ cwd: sandbox.path, isDryRun: false });
    expect(applied.exitCode).toBe(0);
    const reopened = await openSession(sandbox.path);
    const [root] = planRun(reopened, { stage: 'push', skips: [], only: ['javascript/tsc'] });
    // Saved scope policy can outlive its JavaScript inputs and generated compiler configuration.
    const site = { ...root!, scope: reopened.scopes.find((entry) => entry.scope.path === 'site')!, files: [] };
    expect(await checkjs(reopened, site)).toMatchObject({
        check: 'javascript/tsc',
        scope: 'site',
        status: 'passed',
        fileCount: 0,
        findings: [],
    });
});

test.each(['recommended', 'all'] as const)(
    '%s audits selected framework compiler options in their scope',
    async (level) => {
        await using sandbox = await testdir({
            'gspot.toml': buildPolicy(['typescript'], {
                level,
                tables: '[scope."service"]\nconfigurations = ["nestjs"]',
            }),
            'tsconfig.json': VALID,
            'source.ts': 'export const port = 8080;\n',
            'service/tsconfig.json': '{"extends":"../tsconfig.json"}',
            'service/source.ts': 'export const port = 3000;\n',
        });
        const session = await openSession(sandbox.path);
        const input = buildCheckInput(session, 'typescript/tsconfig', {
            scope: 'service',
            paths: ['service/tsconfig.json', 'service/source.ts'],
        });
        expect(
            BUILT_IN_CHECKS['typescript/tsconfig'].input(buildCheckInput(session, 'typescript/tsconfig')),
        ).toStrictEqual([]);
        expect(
            BUILT_IN_CHECKS['typescript/tsconfig'].input(input).map(({ file, rule }) => ({ file, rule })),
        ).toStrictEqual([
            { file: 'service/tsconfig.json', rule: 'experimentalDecorators' },
            { file: 'service/tsconfig.json', rule: 'emitDecoratorMetadata' },
        ]);
        await writeFile(
            join(sandbox.path, 'service/tsconfig.json'),
            '{"extends":"../tsconfig.json","compilerOptions":{"experimentalDecorators":true,"emitDecoratorMetadata":true}}',
        );
        expect(
            BUILT_IN_CHECKS['typescript/tsconfig'].input(
                buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig', {
                    scope: 'service',
                    paths: ['service/tsconfig.json', 'service/source.ts'],
                }),
            ),
        ).toStrictEqual([]);
    },
);
