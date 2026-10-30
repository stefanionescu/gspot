import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/planning/session.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { captureRejection } from '#tests/setup/matchers.ts';
import { STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runSandboxCheck, getBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    COUNT_NUMBER_SOURCE,
    STRICT_OFF_FINDINGS,
    TSCONFIG_READ_ERRORS,
    DEFAULT_LEVEL_TSCONFIG,
    MISSING_TSCONFIG_MESSAGE,
    ALL_LEVEL_OPTION_FINDINGS,
} from '#tests/config/checks/language/language.ts';

test.each([...TSCONFIG_READ_ERRORS])(
    '$name is a read error that names the file, not missing options',
    async ({ tsconfig, error, fixed }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript']),
            'tsconfig.json': tsconfig,
        });

        const failure = await captureRejection(runSandboxCheck(sandbox.path, 'typescript/tsconfig'));
        expect(failure.message).toBe(error.replaceAll('{root}', () => convertToPosixPath(sandbox.path)));
        await writeFile(join(sandbox.path, fixed), STRICT_TSCONFIG_TEXT);
        expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    },
);

test('a scope needs no tsconfig of its own but still checks one that is added', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['typescript']) });

    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
    );
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([...STRICT_OFF_FINDINGS]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test('a nested tsconfig inherits strict from the tsconfig an npm package names, and strict: false is reported in both files', async () => {
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
    const inherited = await getBuiltInCheck('typescript/tsconfig')(session, input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    expect(await getBuiltInCheck('typescript/tsconfig')(session, input)).toStrictEqual(inherited);
    const overridden = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(
        overridden
            .filter((finding) => finding.rule === 'strict')
            .map(({ check, file, rule }) => ({ check, file, rule })),
    ).toStrictEqual([
        { check: 'typescript/tsconfig', file: 'tsconfig.json', rule: 'strict' },
        { check: 'typescript/tsconfig', file: 'apps/web/tsconfig.json', rule: 'strict' },
    ]);
});

test('level basic does not require noImplicitReturns and noPropertyAccessFromIndexSignature, and level all does', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'basic' }),
        'tsconfig.json': JSON.stringify(DEFAULT_LEVEL_TSCONFIG),
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'gspot.toml'), buildSandboxSettings(['typescript'], { level: 'all' }));
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule, message }) => ({ file, rule, message }))).toStrictEqual([
        ...ALL_LEVEL_OPTION_FINDINGS,
    ]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test(`a scope's framework compiler options are required in its tsconfig`, async () => {
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
        await getBuiltInCheck('typescript/tsconfig')(
            session,
            planSandboxCheck(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict', message: 'strict is not on in this tsconfig.' }]);
    expect(() =>
        getBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'The tsconfig of a parent folder covers this project, and gspot checks it there.',
        }),
    );
    const reopened = await openSession(sandbox.path);
    expect(
        await getBuiltInCheck('typescript/tsconfig')(reopened, planSandboxCheck(reopened, 'typescript/tsconfig')),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict', message: 'strict is not on in this tsconfig.' }]);
    expect(() =>
        getBuiltInCheck('typescript/tsconfig')(
            reopened,
            planSandboxCheck(reopened, 'typescript/tsconfig', { scope: 'app' }),
        ),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'The tsconfig of a parent folder covers this project, and gspot checks it there.',
        }),
    );
});

test('a child excluded from the root project is its own compiler project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], {
            level: 'all',
            scopes: [{ path: 'app', configurations: ['typescript'] }],
        }),
        'tsconfig.json': '{"compilerOptions":{"strict":true},"include":["root.ts"],"exclude":["app/**"]}',
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([
        {
            check: 'typescript/tsconfig',
            file: 'app/tsconfig.json',
            rule: 'missing',
            message: MISSING_TSCONFIG_MESSAGE,
            help: 'Turn on the reported compiler option in your tsconfig.',
            fixable: false,
        },
    ]);
    await writeFile(join(sandbox.path, 'app/tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([]);
});

test('TypeScript sources without a compiler project give one setup finding', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'source.ts': COUNT_NUMBER_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toMatchObject([
        { file: 'tsconfig.json', rule: 'missing', message: MISSING_TSCONFIG_MESSAGE },
    ]);
    await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
});

test('a solution tsconfig leaves compiler option checks to its referenced projects', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}',
        'tsconfig.app.json': JSON.stringify(DEFAULT_LEVEL_TSCONFIG),
        'source.ts': COUNT_NUMBER_SOURCE,
    });
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    await writeFile(join(sandbox.path, 'tsconfig.app.json'), JSON.stringify({ compilerOptions: { strict: false } }));
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'tsconfig.app.json', rule: 'strict' },
    ]);
});

test('strict requires explicitly disabled members of the strict family', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript']),
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":true,"strictNullChecks":false'),
    });
    const findings = await runSandboxCheck(sandbox.path, 'typescript/tsconfig');
    expect(findings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
        { file: 'tsconfig.json', rule: 'strictNullChecks' },
    ]);
});
