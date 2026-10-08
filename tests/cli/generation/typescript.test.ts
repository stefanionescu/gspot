import { join } from 'node:path';
import * as fs from 'node:fs/promises';
import { test, expect } from 'bun:test';
import { throws } from 'node:assert/strict';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/outputs.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { VALID } from '#tests/config/samples/typescript.ts';
import { MALFORMED_COMPILER_CONFIGURATIONS } from '#tests/config/cli/generation/typescript.ts';

test.each(MALFORMED_COMPILER_CONFIGURATIONS)(
    'malformed TypeScript configuration fails generation: %s',
    async (content, detail) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'tsconfig.json': content,
            'gspot.toml': buildPolicy(['typescript']),
            'source.ts': 'export const value = 1;\n',
        });
        const session = await openSession(sandbox.path);
        throws(() => emitAll(session), {
            message: `Cannot read TypeScript configuration ${join(sandbox.path, 'tsconfig.json')}: ${detail}`,
        });
    },
);

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
    expect(await fs.readFile(join(sandbox.path, 'tsconfig.json'), 'utf8')).toBe(VALID);
});
