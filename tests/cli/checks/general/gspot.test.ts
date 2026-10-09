// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { testdir, createFileTree } from 'testdirs';
import { openSession } from '#cli/commands/public.ts';
import { BUILT_IN_CHECKS } from '#cli/checks/public.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { AUTHORED_PATH_CASES } from '#tests/config/cli/checks/general/gspot.ts';

test('check path ignores must match tracked paths even when documentation mentions them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md': 'The runner writes `.reports/output.json`.\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            level: 'all',
            check: Object.fromEntries([
                ['__proto__', { command: ['git', 'status'], paths: ['missing-prototype.ts'], stage: 'manual' }],
            ]),
            configurations: ['docs', 'structure', 'nextjs'],
            generated: [{ paths: ['missing.d.ts'], reason: 'The authored output must match a tracked file.' }],
            ignore: [
                {
                    check: 'docs/lychee',
                    paths: ['.reports/output.json', '.reports/unused.json'],
                    reason: 'An obsolete source exclusion.',
                },
            ],
        }),
    );
    const selected = buildCheckInput(await openSession(sandbox.path), 'gspot/unmatched-paths', {
        paths: ['docs/guide.md'],
    });
    const findings = await BUILT_IN_CHECKS['gspot/unmatched-paths'].input(selected);
    expect(findings.map(({ message: description }) => description)).toStrictEqual([
        '.reports/output.json under [[ignore]] matches no tracked file or folder.',
        '.reports/unused.json under [[ignore]] matches no tracked file or folder.',
        'missing.d.ts under [[generated]] matches no tracked file or folder.',
        'missing-prototype.ts under check.__proto__ matches no tracked file or folder.',
    ]);
});

test.each(AUTHORED_PATH_CASES)('$name', async ({ files, policy, unmatched }) => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, { ...files, 'gspot.toml': stringify({ level: 'all', ...policy }) });
    commitAll(sandbox.path);
    const session = await openSession(sandbox.path);
    expect(session.policyFiles.errors).toStrictEqual([]);
    const findings = await BUILT_IN_CHECKS['gspot/unmatched-paths'].input(
        buildCheckInput(session, 'gspot/unmatched-paths'),
    );
    expect(findings.map((finding) => finding.message.split(' under ', 1)[0])).toStrictEqual(unmatched);
    expect(findings).toMatchObject(
        unmatched.map(() => ({
            check: 'gspot/unmatched-paths',
            file: 'gspot.toml',
            line: 1,
            rule: 'unmatched-pattern',
        })),
    );
});
