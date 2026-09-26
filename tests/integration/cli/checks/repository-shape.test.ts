import { describe, expect, test } from 'bun:test';
import { createFileTree, testdir } from 'testdirs';
// The repository-shape integrity analyses: suppressions, policy patterns, large files and configuration purity.
import { engineInput } from '#cli/execution/engines.ts';
import { openSession } from '#cli/execution/session.ts';
import { checkInput } from '#tests/support/cli/input.ts';
import { largeFiles } from '#cli/checks/repository/large-files.ts';
import { suppressions } from '#cli/checks/repository/suppressions.ts';
import { allowlistsMatch } from '#cli/checks/repository/allowlists-match.ts';
import { configurationPurity } from '#cli/checks/repository/config-purity.ts';

const policy = {
    configurations: ['typescript', 'docs'],
    ignore: [{ check: 'x/y', paths: ['gone/**'], reason: 'A test reason.' }],
    generated: [{ paths: ['data/**'], reason: 'The fixture owns generated output.' }],
    structure: { single_file_folder_allowed: [{ paths: ['src'], reason: 'A test reason.' }] },
    tools: { docs: { paths_allowed: [{ patterns: ['docs/**'], reason: 'A test reason.' }] } },
    architecture: { roles: { config: 'config' } },
};

describe('the repository-shape analyses', () => {
    test('suppression validation ignores source text and valid reasons but reports missing required reasons', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, {
            'gspot.toml': 'version = 1\nrequire_reasons = true\nconfigurations = ["typescript", "bash", "security"]\n',
            'a.ts': 'const marker = /eslint-disable/u; // eslint-disable-next-line no-x -- Required generated protocol binding.\nlet y; // eslint-disable-line\n',
            'b.sh': '# shellcheck disable=SC2086 # reason: the split is wanted\necho x # nosemgrep\n',
        });
        const session = await openSession(sandbox.path);
        const scope = session.scopes[0]!;
        const spec = scope.selected
            .flatMap((manifest) => manifest.checks)
            .find((check) => check.name === 'integrity/suppressions')!;
        const observation = engineInput(session, { scope, spec, files: session.repository.files });
        const found = suppressions(observation);
        expect(found.map((finding) => `${finding.file}:${String(finding.line)} ${finding.rule ?? ''}`)).toStrictEqual([
            'a.ts:2 eslint-no-reason',
            'b.sh:2 semgrep',
        ]);
    });

    test('a policy pattern that names nothing tracked is reported, a folder or glob that does is not', async () => {
        await using sandbox = await testdir();
        await createFileTree(sandbox.path, { 'src/a.ts': '', 'data/x.bin': '', 'docs/a.md': '' });
        const paths = ['src/a.ts', 'data/x.bin', 'docs/a.md'];
        const found = allowlistsMatch(await checkInput(sandbox.path, 'integrity/allowlists-match', paths, policy));
        expect(found.map((finding) => finding.message)).toStrictEqual([
            'gone/** under [[ignore]] matches no tracked file or folder.',
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
        const found = await configurationPurity(
            await checkInput(sandbox.path, 'integrity/config-purity', paths, policy),
        );
        expect(found.map((finding) => `${finding.file}:${String(finding.line)}`)).toStrictEqual([
            'config/logic.ts:1',
            'config/logic.ts:3',
            'config/logic.ts:4',
        ]);
    });
});
