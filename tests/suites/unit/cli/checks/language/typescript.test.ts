import { join } from 'node:path';
import { testdir } from 'testdirs';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { openSession } from '#cli/session.ts';
import { buildSandboxSettings } from '#tests/setup/cli/settings.ts';
import { runSandboxCheck, findBuiltInCheck, planSandboxCheck } from '#tests/setup/cli/checks.ts';

import {
    ROOT_PORT_SOURCE,
    CHILD_PORT_SOURCE,
    STRICT_TSCONFIG_TEXT,
    TSCONFIG_READ_ERRORS,
    MISSING_TSCONFIG_FINDINGS,
    ALL_LEVEL_OPTION_FINDINGS,
    RECOMMENDED_COMPILER_OPTIONS,
} from '#tests/config/checks/language/typescript.ts';

test.each([...TSCONFIG_READ_ERRORS])(
    '$name is a read error that names the file, not missing options',
    async ({ tsconfig, error, fixed }) => {
        await using sandbox = await testdir({
            'gspot.toml': buildSandboxSettings(['typescript']),
            'tsconfig.json': tsconfig,
        });

        const session = await openSession(sandbox.path);
        const input = planSandboxCheck(session, 'typescript/tsconfig');
        expect(() => findBuiltInCheck('typescript/tsconfig')(session, input)).toThrow(error);
        await writeFile(join(sandbox.path, fixed), STRICT_TSCONFIG_TEXT);
        expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    },
);
test('a scope needs no tsconfig of its own but still checks one that is added', async () => {
    await using sandbox = await testdir({ 'gspot.toml': buildSandboxSettings(['typescript']) });

    const session = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
    ).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'tsconfig.json'),
        STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
    );
    expect(await runSandboxCheck(sandbox.path, 'typescript/tsconfig')).toStrictEqual([...MISSING_TSCONFIG_FINDINGS]);
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
    const inherited = await findBuiltInCheck('typescript/tsconfig')(session, input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    await writeFile(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    expect(await findBuiltInCheck('typescript/tsconfig')(session, input)).toStrictEqual(inherited);
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
test('level recommended does not require noImplicitReturns and noPropertyAccessFromIndexSignature, and level all does', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSandboxSettings(['typescript'], { level: 'recommended' }),
        'tsconfig.json': JSON.stringify(RECOMMENDED_COMPILER_OPTIONS),
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
    const session = await openSession(sandbox.path);

    expect(await runSandboxCheck(session.root, 'typescript/tsconfig')).toStrictEqual([]);
    const findings = await runSandboxCheck(session.root, 'typescript/tsconfig', {
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
        await findBuiltInCheck('typescript/tsconfig')(
            session,
            planSandboxCheck(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict', message: 'strict is not on in this tsconfig.' }]);
    expect(() =>
        findBuiltInCheck('typescript/tsconfig')(session, planSandboxCheck(session, 'typescript/tsconfig')),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            message: 'The tsconfig of a parent folder covers this project, and gspot checks it there.',
        }),
    );
    const reopened = await openSession(sandbox.path);
    expect(
        await findBuiltInCheck('typescript/tsconfig')(reopened, planSandboxCheck(reopened, 'typescript/tsconfig')),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict', message: 'strict is not on in this tsconfig.' }]);
    expect(() =>
        findBuiltInCheck('typescript/tsconfig')(
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
    const session = await openSession(sandbox.path);
    expect(await runSandboxCheck(session.root, 'typescript/tsconfig', { scope: 'app' })).toStrictEqual([]);
});
