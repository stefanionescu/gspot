import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { policyOf } from '#tests/harness/cli/policy.ts';
import { sessionInput } from '#tests/harness/cli/input.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { tsconfigOptions } from '#cli/checks/language/typescript.ts';

const TSCONFIG_OPTIONS_POLICY = policyOf(['typescript']);

const VALID = JSON.stringify({
    compilerOptions: {
        strict: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        exactOptionalPropertyTypes: true,
    },
});

test('malformed TypeScript configuration reports its path instead of missing options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY, 'tsconfig.json': '{' });
    const input = await sessionInput(sandbox.path, 'integrity/tsconfig-options');
    expect(() => tsconfigOptions(input)).toThrow(
        `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
    );
    fs.writeFileSync(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(tsconfigOptions(await sessionInput(sandbox.path, 'integrity/tsconfig-options'))).toStrictEqual([]);
});

test('a missing inherited configuration cannot be replaced by empty compiler options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TSCONFIG_OPTIONS_POLICY,
        'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
    });
    const input = await sessionInput(sandbox.path, 'integrity/tsconfig-options');
    // TypeScript prints the inherited path with forward slashes on every platform.
    expect(() => tsconfigOptions(input)).toThrow(`Cannot read file '${toPosix(join(sandbox.path, 'missing.json'))}'`);
    fs.writeFileSync(join(sandbox.path, 'missing.json'), VALID);
    expect(tsconfigOptions(await sessionInput(sandbox.path, 'integrity/tsconfig-options'))).toStrictEqual([]);
});

test('a scope without tsconfig.json reports the missing configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY });
    const findings = tsconfigOptions(await sessionInput(sandbox.path, 'integrity/tsconfig-options'));
    expect(findings).toMatchObject([
        {
            check: 'integrity/tsconfig-options',
            file: 'tsconfig.json',
            message: textContaining('no tsconfig.json'),
        },
    ]);
    fs.writeFileSync(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(tsconfigOptions(await sessionInput(sandbox.path, 'integrity/tsconfig-options'))).toStrictEqual([]);
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
    const input = await sessionInput(sandbox.path, 'integrity/tsconfig-options');
    const inherited = tsconfigOptions(input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    fs.writeFileSync(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    const overridden = tsconfigOptions(input);
    expect(
        overridden
            .filter((finding) => finding.rule === 'strict')
            .map(({ check, file, rule }) => ({ check, file, rule })),
    ).toStrictEqual([
        { check: 'integrity/tsconfig-options', file: 'tsconfig.json', rule: 'strict' },
        { check: 'integrity/tsconfig-options', file: 'apps/web/tsconfig.json', rule: 'strict' },
    ]);
});
