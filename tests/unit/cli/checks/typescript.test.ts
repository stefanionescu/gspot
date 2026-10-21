import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { findCheckCode } from '#cli/checks/code.ts';
import { planChecks } from '#cli/planning/checks.ts';
import { openWriter } from '#cli/ownership/writer.ts';
import { generate } from '#cli/generation/generate.ts';
import { writeGeneratedFiles } from '#cli/apply/write.ts';
import { runCheckCode } from '#cli/commands/check/run.ts';
import { buildSandboxSettings } from '#tests/setup/settings.ts';
import { checkFindings, planSandboxCheck, findBuiltInCheck } from '#tests/setup/check-input.ts';

import {
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    STRICT_TSCONFIG_TEXT,
    TSCONFIG_READ_ERRORS,
} from '#tests/data/checks/typescript/projects.ts';

test('tsc: a scope whose project lists no JavaScript file passes with nothing to compile', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['javascript'], {
            scopes: [{ path: 'site', configurations: ['javascript'] }],
        }),
        'source/main.js': 'export const value = 1;\n',
        'site/README.md': '# No script here\n',
    });

    const session = await openSession(sandbox.path);
    const projects = generate(session).files.filter(({ path }) => path.endsWith('jsconfig.json'));
    expect(projects.map(({ path }) => path)).toStrictEqual(['.gspot/configurations/language/javascript/jsconfig.json']);
    {
        const session = await openSession(sandbox.path);
        using writer = openWriter(sandbox.path);
        writeGeneratedFiles(session, generate(session), writer);
    }
    const reopened = await openSession(sandbox.path);
    const site = planChecks(reopened, {
        stage: 'push',
        only: ['javascript/tsc'],
        staged: ['gspot.toml'],
    }).find((entry) => entry.selection.scope.path === 'site')!;
    expect(await runCheckCode(reopened, site, findCheckCode(site.check))).toMatchObject({
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
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript']),
            'tsconfig.json': tsconfig,
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'typescript/tsconfig');
        expect(() => findBuiltInCheck('typescript/tsconfig')(session, input)).toThrow(error);
        await writeFile(join(sandbox.path, fixed), STRICT_TSCONFIG_TEXT);
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    },
);

test('tsconfig: a scope needs no tsconfig of its own but still checks one that is added', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['typescript']) });

    const session = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
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
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{"extends":"./apps/web/tsconfig.json"}',
        'apps/web/tsconfig.json': '{"extends":"@example/config"}',
        'node_modules/@example/config/package.json': JSON.stringify({
            name: '@example/config',
            tsconfig: filename,
        }),
        [`node_modules/@example/config/${filename}`]: '{"compilerOptions":{"strict":true}}',
    });

    const session = await openSession(sandbox.path);
    const input = planSandboxCheck(session, 'typescript/tsconfig');
    const inherited = await findBuiltInCheck('typescript/tsconfig')(session, input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    expect(await findBuiltInCheck('typescript/tsconfig')(session, input)).toStrictEqual(inherited);
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
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'recommended' }),
        'tsconfig.json': JSON.stringify(options),
    });
    expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['typescript'], { level: 'all' }));
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
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'service', configurations: ['nestjs'] }],
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
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);

    expect(
        await findBuiltInCheck('typescript/tsconfig')(
            session,
            planSandboxCheck(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        findBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'An ancestor compiler check covers this project.',
        }),
    );
    const reopened = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('typescript/tsconfig')(reopened, planSandboxCheck(reopened, 'typescript/tsconfig')),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        findBuiltInCheck('typescript/tsconfig')(
            reopened,
            planSandboxCheck(reopened, 'typescript/tsconfig', { scope: 'app' }),
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
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["root.ts"],"exclude":["app/**"]}',
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);
    expect(await checkFindings(session.root, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([]);
});
