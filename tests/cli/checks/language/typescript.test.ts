import * as fs from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { toPosix } from '#cli/platform/paths.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { buildEngineInput } from '#tests/harness/input.ts';
import { tsconfig } from '#cli/checks/language/typescript.ts';
import { textContaining } from '#tests/harness/expectations.ts';
import { VALID } from '#tests/config/cli/checks/language/tsconfig-options.ts';

const TSCONFIG_OPTIONS_POLICY = buildPolicy(['typescript']);

test('malformed TypeScript configuration reports its path instead of missing options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY, 'tsconfig.json': '{' });
    const input = buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig');
    expect(() => tsconfig(input)).toThrow(
        `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}`,
    );
    fs.writeFileSync(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'))).toStrictEqual([]);
});

test('a missing inherited configuration cannot be replaced by empty compiler options', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': TSCONFIG_OPTIONS_POLICY,
        'tsconfig.json': '{"extends":"./missing.json","compilerOptions":{"strict":true}}',
    });
    const input = buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig');
    // TypeScript prints the inherited path with forward slashes on every platform.
    expect(() => tsconfig(input)).toThrow(`Cannot read file '${toPosix(join(sandbox.path, 'missing.json'))}'`);
    fs.writeFileSync(join(sandbox.path, 'missing.json'), VALID);
    expect(tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'))).toStrictEqual([]);
});

test('a scope without tsconfig.json reports the missing configuration', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { 'gspot.toml': TSCONFIG_OPTIONS_POLICY });
    const findings = tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'));
    expect(findings).toMatchObject([
        {
            check: 'typescript/tsconfig',
            file: 'tsconfig.json',
            message: textContaining('no tsconfig.json'),
        },
    ]);
    fs.writeFileSync(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'))).toStrictEqual([]);
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
    const input = buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig');
    const inherited = tsconfig(input);
    expect(inherited.filter((finding) => finding.rule === 'strict')).toStrictEqual([]);
    fs.writeFileSync(
        join(sandbox.path, 'apps/web/tsconfig.json'),
        '{"extends":"@example/config","compilerOptions":{"strict":false}}',
    );
    const overridden = tsconfig(input);
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
    expect(tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'))).toStrictEqual([]);
    fs.writeFileSync(join(sandbox.path, 'gspot.toml'), buildPolicy(['typescript'], { level: 'all' }));
    const findings = tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'));
    expect(findings).toHaveLength(2);
    expect(new Set(findings.map(({ rule }) => rule))).toStrictEqual(
        new Set(['noImplicitReturns', 'noPropertyAccessFromIndexSignature']),
    );
    fs.writeFileSync(join(sandbox.path, 'tsconfig.json'), VALID);
    expect(tsconfig(buildEngineInput(await openSession(sandbox.path), 'typescript/tsconfig'))).toStrictEqual([]);
});

test('generated compiler flags honor rule exclusions and preserve authored flags', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], {
            tables: '[[ignore]]\ncheck = "typescript/tsconfig"\nrule = "noImplicitReturns"\nreason = "Returns are checked separately."\n',
            level: 'all',
        }),
        'source.ts': 'export const value = 1;',
        'tsconfig.json': VALID,
    });
    const session = await openSession(sandbox.path);
    const output = emitAll(session).files.find((file) => file.path === '.gspot/config/tsconfig.json');
    expect(output).toBeDefined();
    const parsed: unknown = JSON.parse(output!.content);
    expect(parsed).toMatchObject({
        extends: '../../tsconfig.json',
        compilerOptions: { strict: true, noPropertyAccessFromIndexSignature: true },
    });
    expect(parsed).not.toHaveProperty('compilerOptions.noImplicitReturns');
    expect(fs.readFileSync(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe(VALID);
});
