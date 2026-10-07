// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { join } from 'node:path';
import { stringify } from 'smol-toml';
import { test, expect } from 'bun:test';
import { commitAll } from '#tests/harness/git.ts';
import { executeRun } from '#cli/execution/run.ts';
import { testdir, createFileTree } from 'testdirs';
import { buildPolicy } from '#tests/harness/policy.ts';
import { openSession } from '#cli/commands/session.ts';
import { checkInput } from '#cli/execution/built-in.ts';
import { buildCheckInput } from '#tests/harness/input.ts';
import { buildRunOptions } from '#tests/harness/gspot.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { configurationLogic } from '#cli/checks/general/structure/config-logic.ts';
import { staleAllowlists } from '#cli/checks/general/structure/stale-allowlists.ts';
import { REPOSITORY_SHAPE_POLICY } from '#tests/config/cli/checks/general/structure/repository-shape.ts';

test('documentation path exceptions must match tracked paths or actual documentation references', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md': 'The runner writes `.reports/output.json`.\n',
    });
    await Bun.write(
        join(sandbox.path, 'gspot.toml'),
        stringify({
            level: 'all',
            configurations: ['docs', 'structure'],
            docs: {
                exclude: [
                    {
                        paths: ['.reports/output.json', '.reports/unused.json'],
                        reason: 'The runner writes an ignored report.',
                    },
                ],
            },
            ignore: [
                { check: 'docs/lychee', paths: ['.reports/output.json'], reason: 'An obsolete source exclusion.' },
            ],
        }),
    );
    const selected = buildCheckInput(await openSession(sandbox.path), 'structure/stale-allowlists', {
        paths: ['docs/guide.md'],
    });
    expect(staleAllowlists(selected).map(({ message: description }) => description)).toStrictEqual([
        '.reports/output.json under [[ignore]] matches no tracked file or folder.',
        '.reports/unused.json under docs.exclude matches no tracked file or folder.',
    ]);
});
test('suppression validation ignores source values and valid reasons but refuses forbidden markers', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'require_reasons = true\nconfigurations = ["typescript", "bash", "security"]\n',
        'a.ts': 'const marker = /eslint-disable/u; // eslint-disable-next-line no-x -- Required generated protocol binding.\nlet y; // eslint-disable-line\n',
        'b.sh': '# shellcheck disable=SC2086 # reason: the split is wanted\necho x # nosemgrep\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const check = scope.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'structure/suppressions')!;
    const read = checkInput(session, { scope, check, files: session.repository.files });
    const found = await suppressions(read);
    expect(found.map((finding) => `${finding.file}:${String(finding.line)} ${finding.rule ?? ''}`)).toStrictEqual([
        'a.ts:2 eslint-no-reason',
        'b.sh:2 semgrep',
    ]);
});

test('a file over the limit that is neither declared nor under LFS is reported', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'big.bin': Buffer.alloc(2_000_000),
        'data/big.bin': Buffer.alloc(2_000_000),
        'small.txt': 'small',
    });
    const paths = ['big.bin', 'data/big.bin', 'small.txt'];
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY }));
    const found = largeFiles(
        buildCheckInput(await openSession(sandbox.path), 'structure/large-files', { paths: paths }),
    );
    expect(found.map((finding) => finding.file)).toStrictEqual(['big.bin']);
});

test('a configuration module with a function or a call is reported; literals pass', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'config/pure.ts':
            "import type { X } from '#types/x.ts';\n\nexport const NAMES: X[] = ['a'];\nexport const PATTERN = /a/u;\nexport const RAW = String.raw`\\d+`;\n",
        'config/logic.ts':
            "import { readFileSync } from 'node:fs';\n\nexport const text = readFileSync('x', 'utf8');\nexport const pick = (value: string): string => value;\n",
    });
    const paths = ['config/pure.ts', 'config/logic.ts'];
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY }));
    const found = await configurationLogic(
        buildCheckInput(await openSession(sandbox.path), 'structure/config-logic', { paths: paths }),
    );
    expect(found.map((finding) => `${finding.file}:${String(finding.line)}`)).toStrictEqual([
        'config/logic.ts:1',
        'config/logic.ts:3',
        'config/logic.ts:4',
    ]);
});

test('configuration imports follow project aliases and reject runtime owners', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'tsconfig.json': JSON.stringify({
            compilerOptions: { paths: { '#data/*': ['./config/*'], '#feature/*': ['./feature/*'] } },
        }),
        'config/data.ts': 'export const COUNT = 3;\n',
        'config/linked.ts': "import { COUNT } from '#data/data.ts';\nexport const LIMIT = COUNT;\n",
        'config/outside.ts': "import { COUNT } from '#feature/data.ts';\nexport const LIMIT = COUNT;\n",
        'feature/data.ts': 'export const COUNT = 3;\n',
    });
    const paths = ['config/data.ts', 'config/linked.ts', 'config/outside.ts', 'feature/data.ts'];
    await Bun.write(join(sandbox.path, 'gspot.toml'), stringify({ level: 'all', ...REPOSITORY_SHAPE_POLICY }));
    const findings = await configurationLogic(
        buildCheckInput(await openSession(sandbox.path), 'structure/config-logic', { paths: paths }),
    );
    expect(findings.map((finding) => [finding.file, finding.line, finding.rule])).toStrictEqual([
        ['config/outside.ts', 1, 'config-logic'],
    ]);
});

test('folder layout exempts installed dependencies while tracked dependency enforcement reports them', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': buildPolicy(['typescript'], { level: 'all' }),
        'venv/lib/only.ts': '',
        '.venv/lib/only.ts': '',
        'feature/only.ts': '',
    });
    commitAll(sandbox.path);
    const result = await executeRun(
        await openSession(sandbox.path),
        buildRunOptions({
            only: ['structure/lone-files', 'structure/tracked-dependencies'],
        }),
    );
    expect(result.report.checks.find((check) => check.check === 'structure/lone-files')?.findings).toMatchObject([
        { file: 'feature/only.ts', rule: 'lone-file' },
    ]);
    expect(result.report.checks.find((check) => check.check === 'structure/lone-files')?.findings).toHaveLength(1);
    expect(
        result.report.checks
            .find((check) => check.check === 'structure/tracked-dependencies')
            ?.findings.map((finding) => finding.file)
            .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(['.venv', 'venv']);
    expect(result.report.exitCode).toBe(1);
});
