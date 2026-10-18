import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { planRun } from '#cli/planning/checks.ts';
import { testdir, createFileTree } from 'testdirs';
import { generate } from '#cli/generation/generate.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { runRegisteredCommand } from '#tests/setup/run-gspot.ts';
import { checkJavascriptTsc } from '#cli/checks/typescript/tsc.ts';
import { CHECK_IMPLEMENTATIONS } from '#cli/checks/implementations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';

import {
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    STRICT_TSCONFIG_TEXT,
    TSCONFIG_READ_ERRORS,
} from '#tests/data/checks/typescript/projects.ts';

test('tsc: a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['javascript'], {
            tables: '[[scope]]\npath = "site"\nconfigurations = ["javascript"]\n',
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });
    const session = await openSession(sandbox.path);
    const projects = generate(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/config/jsconfig.json']);
    const applied = await runRegisteredCommand(sandbox.path, ['apply']);
    expect(applied.exitCode).toBe(0);
    const reopened = await openSession(sandbox.path);
    const site = planRun(reopened, {
        stage: 'push',

        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((entry) => entry.selection.scope.path === 'site')!;
    expect(await checkJavascriptTsc(reopened, site)).toMatchObject({
        check: 'javascript/tsc',
        scope: 'site',
        status: 'passed',
        fileCount: 0,
        findings: [],
    });
});

test.each([...TSCONFIG_READ_ERRORS])(
    'tsconfig: $name is a read error that names the file, not missing options',
    async ({ tsconfig, error, fixed }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': buildSettingsText(['typescript']),
            'tsconfig.json': tsconfig,
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
        expect(() => CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(input)).toThrow(error);
        await writeFile(join(sandbox.path, fixed), STRICT_TSCONFIG_TEXT);
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    },
);

test('tsconfig: a scope needs no tsconfig of its own but still checks one that is added', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': buildSettingsText(['typescript']) });
    expect(
        CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(
            buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig'),
        ),
    ).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
    );
    expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([
        {
            check: 'typescript/tsconfig',
            file: 'tsconfig.json',
            rule: 'strict',
            fixable: false,
            message: 'strict is not on in this tsconfig.',
            help: 'Enable this compiler option in the TypeScript tool file.',
        },
    ]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test('tsconfig: nested configurations inherit the configuration an ancestor package names', async () => {
    const filename = 'strict.json';
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildSettingsText(['typescript']),
        'tsconfig.json': '{"extends":"./apps/web/tsconfig.json"}',
        'apps/web/tsconfig.json': '{"extends":"@example/config"}',
        'node_modules/@example/config/package.json': JSON.stringify({
            name: '@example/config',
            tsconfig: filename,
        }),
        [`node_modules/@example/config/${filename}`]: '{"compilerOptions":{"strict":true}}',
    });
    const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
    const inherited = CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    expect(CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(input)).toStrictEqual(inherited);
    const overridden = await checkFindings(sandbox.path, 'typescript/tsconfig');
    expect(
        overridden
            .filter((finding) => finding.rule === 'strict')
            .map(({ check, file, rule }) => ({ check, file, rule })),
    ).toStrictEqual([
        { check: 'typescript/tsconfig', file: 'tsconfig.json', rule: 'strict' },
        { check: 'typescript/tsconfig', file: 'apps/web/tsconfig.json', rule: 'strict' },
    ]);
});

test('tsconfig: level recommended allows the two compiler options that level all requires', async () => {
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
        'gspot.toml': buildSettingsText(['typescript'], { level: 'recommended' }),
        'tsconfig.json': JSON.stringify(options),
    });
    expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSettingsText(['typescript'], { level: 'all' }));
    const findings = await checkFindings(sandbox.path, 'typescript/tsconfig');
    expect(findings).toHaveLength(2);
    expect(new Set(findings.map(({ rule }) => rule))).toStrictEqual(
        new Set(['noImplicitReturns', 'noPropertyAccessFromIndexSignature']),
    );
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test('tsconfig: typescript/tsconfig checks the framework compiler options of a scope', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "service"\nconfigurations = ["nestjs"]',
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
        'source.ts': ROOT_PORT_SOURCE,
        'service/tsconfig.json': '{"extends":"../tsconfig.json"}',
        'service/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);

    expect(await checkFindings(session.root, 'typescript/tsconfig')).toStrictEqual([]);
    const findings = await checkFindings(session.root, 'typescript/tsconfig', {
        scope: 'service',
        paths: ['service/tsconfig.json', 'service/source.ts'],
    });
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'service/tsconfig.json', rule: 'experimentalDecorators' },
        { file: 'service/tsconfig.json', rule: 'emitDecoratorMetadata' },
    ]);
    await writeFile(
        join(sandbox.path, 'service/tsconfig.json'),
        '{"extends":"../tsconfig.json","compilerOptions":{"experimentalDecorators":true,"emitDecoratorMetadata":true}}',
    );
    expect(
        await checkFindings(sandbox.path, 'typescript/tsconfig', {
            scope: 'service',
            paths: ['service/tsconfig.json', 'service/source.ts'],
        }),
    ).toStrictEqual([]);
});

test('tsconfig: a covering ancestor tsconfig is checked once and a child-only project keeps its own check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript"]',
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);

    expect(
        CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(
            buildCheckInput(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(buildCheckInput(session, 'typescript/tsconfig')),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'An ancestor compiler check covers this project.',
        }),
    );
    const reopened = await openSession(sandbox.path);
    expect(
        CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(buildCheckInput(reopened, 'typescript/tsconfig')),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        CHECK_IMPLEMENTATIONS['typescript/tsconfig'].check(
            buildCheckInput(reopened, 'typescript/tsconfig', { scope: 'app' }),
        ),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'An ancestor compiler check covers this project.',
        }),
    );
});

test('tsconfig: a child excluded from the root project is its own compiler project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript"]',
        }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["root.ts"],"exclude":["app/**"]}',
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);
    expect(await checkFindings(session.root, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([]);
});
