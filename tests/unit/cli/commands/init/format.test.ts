import { test, expect } from 'bun:test';
import { openSession } from '#cli/session.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parseSettings } from '#cli/settings/read.ts';
import type { InitJson } from '#cli/types/commands/init.ts';
import { createReadCache } from '#cli/system/files/cache.ts';
import { buildInitArguments } from '#tests/setup/builders.ts';
import { FORMAT_FILE_CASES, SCOPE_FORMAT_CASES, SCOPE_FORMAT_FILES } from '#tests/data/commands/init.ts';

test.each([...FORMAT_FILE_CASES])('init reads the format settings from $name', async ({ files, expected }) => {
    await using sandbox = await testdir(files);
    const result = await runGspot(sandbox.path, [...buildInitArguments(['format']), '--dry-run', '--json']);
    expect(result.code, result.stdout + result.stderr).toBe(0);
    const text = (JSON.parse(result.stdout) as InitJson).settings!;
    const session = await openSession(sandbox.path, {
        settings: parseSettings(text, undefined, createReadCache(process.cwd())),
        text,
    });
    expect(session.scopes[0]!.view.options('format')).toMatchObject(expected);
    for (const [path, source] of Object.entries(files))
        expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    expect(await Bun.file(`${sandbox.path}/gspot.toml`).exists()).toBe(false);
});

test.each([...SCOPE_FORMAT_CASES])(
    'init reads the format settings of each scope with $name',
    async ({ template, expected }) => {
        await using sandbox = await testdir(SCOPE_FORMAT_FILES);
        await createFileTree(sandbox.path, {
            'package.json': '{"private":true,"workspaces":["app","app/deep","sibling"]}',
            'app/package.json': '{"private":true}',
            'app/deep/package.json': '{"private":true}',
            'sibling/package.json': '{"private":true}',
            ...(template ? { 'team.template.toml': template } : {}),
        });
        const result = await runGspot(sandbox.path, [
            ...buildInitArguments(['format']),
            '--dry-run',
            '--json',
            ...(template ? ['--from', 'team.template.toml'] : []),
        ]);
        expect(result.code, result.stdout + result.stderr).toBe(0);
        const text = (JSON.parse(result.stdout) as InitJson).settings!;
        const session = await openSession(sandbox.path, {
            settings: parseSettings(text, undefined, createReadCache(process.cwd())),
            text,
        });
        expect(
            session.scopes.map((selection) => [
                selection.scope.path,
                selection.view.options('format').indent_width,
                selection.view.options('format').print_width,
                selection.view.options('format').quotes,
            ]),
        ).toEqual(expected.map((row) => [...row]));
        for (const [path, source] of Object.entries(SCOPE_FORMAT_FILES))
            expect(await Bun.file(`${sandbox.path}/${path}`).text()).toBe(source);
    },
);
