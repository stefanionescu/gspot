import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/session.ts';
import { settingsText } from '#tests/setup/settings.ts';
import { convertToPosixPath } from '#cli/system/paths.ts';
import { CHECK_FUNCTIONS } from '#cli/checks/implementations.ts';
import { checkFindings, buildCheckInput } from '#tests/setup/check-input.ts';
import { ROOT_PORT_SOURCE, CHILD_PORT_SOURCE, STRICT_TSCONFIG_TEXT } from '#tests/config/typescript.ts';

{
    const TSCONFIG_OPTIONS_POLICY = settingsText(['typescript']);

    test('malformed TypeScript configuration reports its path instead of missing options', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY, 'tsconfig.json': '{' });
        const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
        expect(() => CHECK_FUNCTIONS['typescript/tsconfig'](input)).toThrow(
            `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
        );
        await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    });

    test('a missing inherited configuration cannot be replaced by empty compiler options', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': TSCONFIG_OPTIONS_POLICY,
            'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
        });
        const input = buildCheckInput(await openSession(sandbox.path), 'typescript/tsconfig');
        // TypeScript prints the inherited path with forward slashes on every platform.
        expect(() => CHECK_FUNCTIONS['typescript/tsconfig'](input)).toThrow(
            `Cannot read file '${convertToPosixPath(join(sandbox.path, 'missing.json'))}'`,
        );
        await writeFile(join(sandbox.path, 'missing.json'), STRICT_TSCONFIG_TEXT);
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    });

    test('a scope needs no tsconfig of its own but still checks one that is added', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY });
        expect(
            CHECK_FUNCTIONS['typescript/tsconfig'](
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
        const inherited = CHECK_FUNCTIONS['typescript/tsconfig'](input);
        expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
        await writeFile(
            join(sandbox.path, 'apps/web/tsconfig.json'),
            '{"extends":"@example/config","compilerOptions":{"strict":false}}',
        );
        expect(CHECK_FUNCTIONS['typescript/tsconfig'](input)).toStrictEqual(inherited);
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

    test('level recommended allows the two compiler options that level all requires', async () => {
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
            'gspot.toml': settingsText(['typescript'], { level: 'recommended' }),
            'tsconfig.json': JSON.stringify(options),
        });
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
        await writeFile(join(sandbox.path, 'gspot.toml'), settingsText(['typescript'], { level: 'all' }));
        const findings = await checkFindings(sandbox.path, 'typescript/tsconfig');
        expect(findings).toHaveLength(2);
        expect(new Set(findings.map(({ rule }) => rule))).toStrictEqual(
            new Set(['noImplicitReturns', 'noPropertyAccessFromIndexSignature']),
        );
        await writeFile(join(sandbox.path, 'tsconfig.json'), STRICT_TSCONFIG_TEXT);
        expect(await checkFindings(sandbox.path, 'typescript/tsconfig')).toStrictEqual([]);
    });

    test('typescript/tsconfig checks the framework compiler options of a scope', async () => {
        await using sandbox = await testdir({
            'gspot.toml': settingsText(['typescript'], {
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
        const awaitedFindings = await checkFindings(session.root, 'typescript/tsconfig', {
            scope: 'service',
            paths: ['service/tsconfig.json', 'service/source.ts'],
        });
        expect(awaitedFindings.map(({ file, rule }) => ({ file, rule }))).toStrictEqual([
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
}

test('a covering ancestor tsconfig is checked once and a child-only project keeps its own check', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['typescript'], {
            level: 'all',
            tables: '[[scope]]\npath = "app"\nconfigurations = ["typescript"]',
        }),
        'tsconfig.json': STRICT_TSCONFIG_TEXT.replace('"strict":true', '"strict":false'),
        'root.ts': ROOT_PORT_SOURCE,
        'app/source.ts': CHILD_PORT_SOURCE,
    });
    const session = await openSession(sandbox.path);

    expect(
        CHECK_FUNCTIONS['typescript/tsconfig'](
            buildCheckInput(session, 'typescript/tsconfig', { scope: 'app', paths: ['app/source.ts'] }),
        ),
    ).toMatchObject([{ file: 'tsconfig.json', rule: 'strict' }]);
    expect(() => CHECK_FUNCTIONS['typescript/tsconfig'](buildCheckInput(session, 'typescript/tsconfig'))).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            errors: ['An ancestor compiler check covers this project.'],
            message: 'An ancestor compiler check covers this project.',
        }),
    );
    const reopened = await openSession(sandbox.path);
    expect(CHECK_FUNCTIONS['typescript/tsconfig'](buildCheckInput(reopened, 'typescript/tsconfig'))).toMatchObject([
        { file: 'tsconfig.json', rule: 'strict' },
    ]);
    expect(() =>
        CHECK_FUNCTIONS['typescript/tsconfig'](buildCheckInput(reopened, 'typescript/tsconfig', { scope: 'app' })),
    ).toThrow(
        expect.objectContaining({
            name: 'GspotError',
            code: 'skip',
            errors: ['An ancestor compiler check covers this project.'],
            message: 'An ancestor compiler check covers this project.',
        }),
    );
});

test('a child excluded from the root project is its own compiler project', async () => {
    await using sandbox = await testdir({
        'gspot.toml': settingsText(['typescript'], {
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
