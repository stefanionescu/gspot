import { join } from 'node:path';
import { expect, test } from 'bun:test';
import { run } from '#cli/platform/spawn.ts';
import { createFileTree, testdir } from 'testdirs';
import { rejection } from '#tests/support/expectations.ts';
import { commitAll, gitOutput } from '#tests/support/cli/git.ts';
import { useRevision } from '#cli/repository/revisions/contents.ts';

test.each(['index', 'commit'] as const)(
    'a %s snapshot refuses an executable Python path loader and accepts a path declaration',
    async (kind) => {
        await using repository = await testdir();
        const root = repository.path;
        await createFileTree(root, {
            '.gitignore': '.venv/\n',
            'pyproject.toml': '[project]\nname = "loader-fixture"\nversion = "0.0.0"\nrequires-python = ">=3.11"\n',
            'selected_source.py': 'VALUE = "selected"\n',
        });
        for (const command of [
            ['uv', 'lock'],
            ['uv', 'sync', '--frozen'],
        ]) {
            const installed = await run(command, { cwd: root, timeoutMs: 60_000 });
            expect(installed.code, installed.stdout + installed.stderr).toBe(0);
        }
        commitAll(root);
        const source = kind === 'index' ? { kind } : { kind, hash: gitOutput(root, ['rev-parse', 'HEAD']).trim() };
        await Bun.write(join(root, 'selected_source.py'), 'VALUE = "working"\n');
        const sites = await run(
            [join(root, '.venv/bin/python'), '-I', '-c', 'import site; print(site.getsitepackages()[0])'],
            { cwd: root },
        );
        expect(sites.code, sites.stderr).toBe(0);
        const path = join(sites.stdout.trim(), 'custom.pth');
        const bootstrap = `import sys; sys.path.insert(0, ${JSON.stringify(root)})\n`;
        await Bun.write(path, bootstrap);
        expect(await rejection(useRevision(root, source, () => Promise.resolve()))).toContain(
            'Unsupported executable Python path metadata',
        );
        expect(await Bun.file(path).text()).toBe(bootstrap);
        await Bun.write(path, `${root}\n`);
        await useRevision(root, source, async (snapshot) => {
            const result = await run(
                [
                    join(snapshot, '.venv/bin/python'),
                    '-I',
                    '-c',
                    'import selected_source; print(selected_source.VALUE)',
                ],
                { cwd: snapshot },
            );
            expect(result.code, result.stderr).toBe(0);
            expect(result.stdout.trim()).toBe('selected');
        });
        expect(await Bun.file(join(root, 'selected_source.py')).text()).toBe('VALUE = "working"\n');
    },
    90_000,
);
