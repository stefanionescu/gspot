import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { emitAll } from '#cli/generation/public.ts';
import { openSession } from '#cli/commands/public.ts';
import { buildPolicy } from '#tests/harness/policy.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { writeGeneratedFiles } from '#cli/lifecycle/public.ts';
import { getSuggestions } from '#cli/commands/doctor/contracts.ts';
import { openOwnership } from '#cli/lifecycle/ownership/public.ts';
import { COMMITLINT_PACKAGE } from '#tests/config/samples/commitlint.ts';
import { COMMITLINT_SCOPES, COMMITLINT_PROJECT } from '#tests/config/cli/generation/commitlint.ts';

test('repository commit fields preserve unrelated package content and restore it at recommended', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        ...COMMITLINT_PROJECT,
        'gspot.toml': buildPolicy([], { level: 'all', tables: COMMITLINT_SCOPES }),
    });
    commitAll(sandbox.path);
    let session = await openSession(sandbox.path);
    const generated = emitAll(session);
    expect(generated.toolFiles).toStrictEqual([
        {
            path: 'package.json',
            changes: [{ path: ['commitlint'], value: { extends: './.gspot/config/commitlint.config.cjs' } }],
        },
        {
            path: 'app/child/package.json',
            changes: [{ path: ['commitlint'], value: { extends: '../../.gspot/config/commitlint.config.cjs' } }],
        },
        {
            path: 'app/package.json',
            changes: [{ path: ['commitlint'], value: { extends: '../.gspot/config/commitlint.config.cjs' } }],
        },
    ]);
    {
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, generated, log);
        expect(log.entryFor('app/package.json')?.configuration?.format).toBe('json');
    }
    expect(await readFile(join(sandbox.path, 'plain/package.json'), 'utf8')).toBe('{"private":true}\n');
    session = await openSession(sandbox.path);
    expect(getSuggestions(session).unowned.filter((row) => row.path.endsWith('package.json'))).toStrictEqual([]);
    const installed = await readFile(join(sandbox.path, 'app/package.json'), 'utf8');
    await writeFile(join(sandbox.path, 'app/package.json'), installed.replace('native-project', 'edited-project'));
    await writeFile(join(sandbox.path, 'gspot.toml'), buildPolicy([], { level: 'recommended' }));
    session = await openSession(sandbox.path);
    expect(emitAll(session).toolFiles).toStrictEqual([]);
    {
        using log = openOwnership(sandbox.path);
        writeGeneratedFiles(session, emitAll(session), log);
        expect(log.entryFor('package.json')).toBeUndefined();
        expect(log.entryFor('app/package.json')).toBeUndefined();
    }
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
    expect(await readFile(join(sandbox.path, 'app/package.json'), 'utf8')).toBe(
        COMMITLINT_PACKAGE.replace('native-project', 'edited-project'),
    );
    expect(
        getSuggestions(await openSession(sandbox.path))
            .unowned.filter((row) => row.note.includes('commitlint'))
            .map(({ path, command }) => ({ path, command })),
    ).toStrictEqual([
        { path: 'app/child/package.json', command: 'gspot set level all' },
        { path: 'app/package.json', command: 'gspot set level all' },
        { path: 'package.json', command: 'gspot set level all' },
    ]);
});

test('a folder without Git keeps authored commit policy and reports its actual prerequisite', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'package.json': COMMITLINT_PACKAGE,
        'gspot.toml': buildPolicy([], { level: 'all' }),
    });
    const session = await openSession(sandbox.path);
    expect(emitAll(session).toolFiles).toStrictEqual([]);
    expect(getSuggestions(session).unowned.filter((row) => row.note.includes('commitlint'))).toStrictEqual([
        { path: 'package.json', note: 'commitlint requires a Git repository', command: 'git init' },
    ]);
    expect(await readFile(join(sandbox.path, 'package.json'), 'utf8')).toBe(COMMITLINT_PACKAGE);
});
