// The repository-shape integrity analyses: suppressions, policy patterns, large files, and configuration purity.
import { test, expect } from 'bun:test';
import { testdir, createFileTree } from 'testdirs';
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { checkInput } from '#tests/harness/cli/input.ts';
import { largeFiles } from '#cli/checks/general/structure/large-files.ts';
import { suppressions } from '#cli/checks/general/structure/suppressions.ts';
import { fileIntegrity } from '#cli/checks/general/structure/config-logic.ts';
import { allowlistsMatch } from '#cli/checks/general/structure/stale-allowlists.ts';

const policy = {
    kits: ['typescript', 'docs'],
    ignore: [{ check: 'x/y', paths: ['gone/**'], reason: 'A test reason.' }],
    generated: [{ paths: ['data/**'], reason: 'The fixture owns generated output.' }],
    structure: { single_file_folder_allowed: [{ paths: ['src'], reason: 'A test reason.' }] },
    tools: { docs: { paths_allowed: [{ patterns: ['docs/**'], reason: 'A test reason.' }] } },
    architecture: { roles: { config: 'config' } },
};

test('documentation path exceptions must match tracked paths or actual documentation references', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'docs/guide.md': 'The runner writes `.reports/output.json`.\n',
    });
    const selected = await checkInput(sandbox.path, 'integrity/allowlists-match', ['docs/guide.md'], {
        kits: ['docs'],
        tools: {
            docs: {
                paths_allowed: [
                    {
                        patterns: ['.reports/output.json', '.reports/unused.json'],
                        reason: 'The runner writes an ignored report.',
                    },
                ],
            },
        },
        ignore: [{ check: 'docs/links', paths: ['.reports/output.json'], reason: 'An obsolete source exclusion.' }],
    });
    expect(allowlistsMatch(selected).map(({ message: description }) => description)).toStrictEqual([
        '.reports/output.json under [[ignore]] matches no tracked file or folder.',
        '.reports/unused.json under tools.docs.paths_allowed matches no tracked file or folder.',
    ]);
});
test('suppression validation ignores source text and valid reasons but reports missing required reasons', async () => {
    await using sandbox = await testdir();
    await createFileTree(sandbox.path, {
        'gspot.toml': 'require_reasons = true\nkits = ["typescript", "bash", "security"]\n',
        'a.ts': 'const marker = /eslint-disable/u; // eslint-disable-next-line no-x -- Required generated protocol binding.\nlet y; // eslint-disable-line\n',
        'b.sh': '# shellcheck disable=SC2086 # reason: the split is wanted\necho x # nosemgrep\n',
    });
    const session = await openSession(sandbox.path);
    const scope = session.scopes[0]!;
    const spec = scope.selected
        .flatMap((manifest) => manifest.checks)
        .find((check) => check.name === 'integrity/suppressions')!;
    const read = engineInput(session, { scope, spec, files: session.repository.files });
    const found = await suppressions(read);
    expect(found.map((finding) => `${finding.file}:${String(finding.line)} ${finding.rule ?? ''}`)).toStrictEqual([
        'a.ts:2 eslint-no-reason',
        'b.sh:2 semgrep-no-reason',
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
    const found = largeFiles(await checkInput(sandbox.path, 'integrity/large-files', paths, policy));
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
    const found = await fileIntegrity(await checkInput(sandbox.path, 'integrity/files', paths, policy));
    expect(found.map((finding) => `${finding.file}:${String(finding.line)}`)).toStrictEqual([
        'config/logic.ts:1',
        'config/logic.ts:3',
        'config/logic.ts:4',
    ]);
});
