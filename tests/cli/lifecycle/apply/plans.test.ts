import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { pathExists } from '#tests/harness/preservation.ts';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import type { PackageJson } from '#cli/types/parsers/packages.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';

test('apply refuses a plan whose policy changed after the session was read', async () => {
    await using sandbox = await testdir();
    const initial = buildPolicy([]);
    await createFileTree(sandbox.path, { 'gspot.toml': initial });
    const session = await openSession(sandbox.path);
    const edited = `level = "all"\n${initial}`;
    await Bun.write(join(sandbox.path, 'gspot.toml'), edited);
    {
        using log = openOwnership(session.root);
        expect(() => writeGeneratedFiles(session, emitAll(session), log)).toThrow(
            'The gspot.toml file changed while gspot was running. Run the command again.',
        );
    }
    expect(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')).toBe(edited);
    expect(await pathExists(join(sandbox.path, '.gspot/state/ownership.json'))).toBe(false);
});

test('a bun runner preserves the authored scripts and adds no task of its own', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy([], { tables: 'runner = "bun"\n' }),
        'package.json': '{"private":true,"scripts":{"prepare":"build-app"}}\n',
    });
    {
        using log = openOwnership(sandbox.path);
        const session = await openSession(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
    }
    const content = JSON.parse(await readFile(join(sandbox.path, 'package.json'), 'utf8')) as Required<
        Pick<PackageJson, 'scripts'>
    >;
    expect(content.scripts).toStrictEqual({ prepare: 'build-app' });
});
