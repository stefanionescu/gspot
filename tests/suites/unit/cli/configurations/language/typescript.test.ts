import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { expect, test } from 'bun:test';

import { runChecks } from '#cli/engine/run.ts';
import { openSession } from '#cli/engine/session.ts';
import {
    ALL_LEVEL_OPTION_FINDINGS,
    CHILD_PORT_SOURCE,
    COUNT_NUMBER_SOURCE,
    DEFAULT_LEVEL_TSCONFIG,
    ROOT_PORT_SOURCE,
    STRICT_OFF_FINDINGS,
} from '#tests/config/configurations/language.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/setup/languages.ts';
import { getBuiltInCheck, planSandboxCheck, runSandboxCheck } from '#tests/setup/cli/checks.ts';
import { buildRunOptions } from '#tests/setup/cli/run.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { matchFields } from '#tests/setup/matchers.ts';
import { createGitSandbox } from '#tests/setup/sandboxes/repositories.ts';

test('malformed JSON is an unreadable finding that names the file, not missing options', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{',
    });

    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        {
            file: 'tsconfig.json',
            rule: 'unreadable',
            message: "Cannot read the compiler settings in tsconfig.json: '}' expected.",
        },
    ]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test('a scope needs no tsconfig of its own but still checks one that is added', async () => {
    await using sandbox = await createGitSandbox({ 'gspot.toml': buildSandboxSettings(['typescript']) });

    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
    );
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual(
        STRICT_OFF_FINDINGS.map((finding) => matchFields(finding)),
    );
});

test('level basic does not require noImplicitReturns and noPropertyAccessFromIndexSignature, and level all does', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'basic' }),
        'tsconfig.json': JSON.stringify(DEFAULT_LEVEL_TSCONFIG),
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['typescript'], { level: 'all' }));
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        ...ALL_LEVEL_OPTION_FINDINGS,
    ]);
});

test(`a scope's framework compiler options are required in its tsconfig`, async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'service', configurations: ['nestjs'] }],
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
        'source.ts': ROOT_PORT_SOURCE,
        'service/tsconfig.json': '{"extends":"../tsconfig.json"}',
        'service/source.ts': CHILD_PORT_SOURCE,
    });

    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig', {
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
        await runSandboxCheck(sandbox.path, 'typescript/tsconfig', {
            scope: 'service',
            paths: ['service/tsconfig.json', 'service/source.ts'],
        }),
    ).toStrictEqual([]);
});

test('a covering ancestor tsconfig is checked once and a child-only project keeps its own check', async () => {
    await using sandbox = await createGitSandbox({
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
        await getBuiltInCheck('typescript/tsconfig')(
            session,
            planSandboxCheck(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        getBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
    ).toThrow(expect.objectContaining({ name: 'CheckStop', status: 'skipped' }));
    const reopened = await openSession(sandbox.path);
    expect(
        await getBuiltInCheck('typescript/tsconfig')(reopened, planSandboxCheck(reopened, 'typescript/tsconfig')),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() =>
        getBuiltInCheck('typescript/tsconfig')(
            reopened,
            planSandboxCheck(reopened, 'typescript/tsconfig', { scope: 'app' }),
        ),
    ).toThrow(expect.objectContaining({ name: 'CheckStop', status: 'skipped' }));
});

test('a nested scope that a root tsconfig covers is skipped as replaced', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const { report } = await runChecks(
        await openSession(sandbox.path),
        buildRunOptions({ only: ['typescript/tsconfig'] }),
    );
    expect(report.checks.find(({ scope }) => scope === 'app')).toMatchObject({ status: 'skipped', cause: 'replaced' });
});

test('a child excluded from the root project is its own compiler project', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["root.ts"],"exclude":["app/**"]}',
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([
        expect.objectContaining({ file: 'app/tsconfig.json', rule: 'missing' }),
    ]);
    await writeFile(join(sandbox.path, 'app/tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([]);
});

test('a solution tsconfig leaves compiler option checks to its referenced projects', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}',
        'tsconfig.app.json': JSON.stringify(DEFAULT_LEVEL_TSCONFIG),
        'source.ts': COUNT_NUMBER_SOURCE,
    });
    await writeFile(join(sandbox.path, 'tsconfig.app.json'), JSON.stringify({ compilerOptions: { strict: false } }));
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'tsconfig.app.json', rule: 'strict' },
    ]);
});

test('strict requires explicitly disabled members of the strict family', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":true,"strictNullChecks":false'),
    });
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'tsconfig.json', rule: 'strictNullChecks' },
    ]);
});

test('a template tsconfig that extends an uninstalled package is a finding of its scope, and stops no config', async () => {
    await using sandbox = await createGitSandbox({
        'gspot.toml': buildSandboxSettings(['javascript', 'typescript']),
        'package.json': '{"private":true,"type":"module"}\n',
        'tsconfig.json': STRICT_TSCONFIG_TEXT,
        'src/index.ts': 'export const value = 1;\n',
        'templates/app/tsconfig.json': '{"extends":"@tsconfig/svelte/tsconfig.json","include":["src"]}\n',
        'templates/app/src/main.ts': 'export const app = 1;\n',
    });
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'templates/app/tsconfig.json', rule: 'unreadable' },
    ]);
});
