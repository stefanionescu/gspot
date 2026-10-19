import { join } from 'node:path';
import { test, expect } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { commitAll } from '#tests/setup/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { runGspot } from '#tests/setup/run-gspot.ts';
import { parse, stringify } from '@decimalturn/toml-patch';
import { checkFindings } from '#tests/setup/check-input.ts';
import type { TomlTable } from '#cli/types/settings/file.ts';
import { buildSettingsText } from '#tests/setup/settings.ts';
import { UNUSED_PATH_CASES } from '#tests/data/checks/gspot/unmatched-patterns.ts';

test.each([...UNUSED_PATH_CASES])(
    'gspot/unmatched-patterns reports only paths without tracked matches: $name',
    async ({ files, settings, unmatched }) => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { ...files, 'gspot.toml': stringify({ level: 'all', ...settings }) });
        commitAll(sandbox.path);
        const findings = await checkFindings(sandbox.path, 'gspot/unmatched-patterns');
        expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual([...unmatched]);
        expect(findings).toMatchObject(
            unmatched.map(() => ({
                check: 'gspot/unmatched-patterns',
                file: 'gspot.toml',
                line: 1,
                rule: 'unused-record',
            })),
        );
    },
);

test('gspot ignore escapes a route folder in its paths, and a pattern with a bare group gets the escape hint', async () => {
    await using sandbox = await testdir({
        'gspot.toml': buildSettingsText(['typescript'], {}),
        'app/(legal)/terms/page.tsx': 'export default function Terms() { return null; }\n',
    });
    commitAll(sandbox.path);
    const ignored = await runGspot(sandbox.path, [
        'ignore',
        'structure/lone-files',
        '--paths',
        'app/(legal)/**',
        '--reason',
        'Next.js route groups hold one page each.',
    ]);
    expect(ignored.code, ignored.stdout + ignored.stderr).toBe(0);
    const written = parse(await readFile(join(sandbox.path, 'gspot.toml'), 'utf8')) as TomlTable;
    expect(written['ignore']).toMatchObject([{ paths: [String.raw`app/\(legal\)/**`] }]);
    expect(await checkFindings(sandbox.path, 'gspot/unmatched-patterns')).toStrictEqual([]);
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        buildSettingsText(['typescript'], {
            tables: '[[ignore]]\ncheck = "structure/lone-files"\npaths = ["app/(missing)/**"]\nreason = "A route group."\n',
        }),
    );
    const unmatched = await checkFindings(sandbox.path, 'gspot/unmatched-patterns');
    expect(unmatched.map(({ message }) => message)).toStrictEqual([
        String.raw`app/(missing)/** under [[ignore]] matches no tracked file or folder. If a folder name holds ( ) [ ], escape each with a backslash in a TOML literal string, such as 'app/\(legal\)/**'.`,
    ]);
});
