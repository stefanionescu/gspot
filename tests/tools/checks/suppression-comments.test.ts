import { basename } from 'node:path';
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/execution/session.ts';
import { runTestCommand } from '#tests/harness/command.ts';
import { suppressionComments } from '#cli/checks/general/structure/suppressions.ts';
import { RUFF_DIRECTIVES } from '#tests/config/tools/checks/suppression-comments.ts';

test('suppression detection agrees with Ruff on every directive form and placement', async () => {
    await using sandbox = await testdir();
    const paths = RUFF_DIRECTIVES.map((_, index) => `source_${String(index)}.py`);
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['python'], { level: 'all' }),
        ...Object.fromEntries(RUFF_DIRECTIVES.map(({ source }, index) => [paths[index]!, source])),
    });
    const native = await runTestCommand(
        ['ruff', 'check', '--isolated', '--select', 'F401', '--output-format', 'json', ...paths],
        { cwd: sandbox.path },
    );
    expect(native.code, native.stdout + native.stderr).toBe(1);
    const reported = new Set(
        (JSON.parse(native.stdout) as Record<'filename', string>[]).map(({ filename }) => basename(filename)),
    );
    const session = await openSession(sandbox.path);
    const comments = await suppressionComments(session.root, session.scopes, session.reads, session.repository.files);
    expect(
        paths.map((path) => ({
            path,
            suppressed: !reported.has(path),
            directives: comments.filter((comment) => comment.file === path).map(({ line, form }) => ({ line, form })),
        })),
    ).toStrictEqual(
        RUFF_DIRECTIVES.map(({ suppressed, directive }, index) => ({
            path: paths[index]!,
            suppressed,
            directives: directive ? [{ line: 1, form: 'ruff' }] : [],
        })),
    );
});
