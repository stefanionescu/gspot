// The repository-shape integrity analyses: suppressions, policy patterns, large files and configuration purity.
import { createSandbox } from '@gspot/testing';
import { describe, expect, test } from 'bun:test';
import type { CheckSpec } from '#types/manifest.ts';
import type { EngineInput, Session } from '#types/run.ts';
import { readAttributes } from '#cli/repository/natures.ts';
import { largeFiles } from '#cli/checks/repository/large-files.ts';
import type { Repository, TrackedFile } from '#types/repository.ts';
import { suppressions } from '#cli/checks/repository/suppressions.ts';
import type { MergedView, NamingSettings, Policy } from '#types/config.ts';
import { allowlistsMatch } from '#cli/checks/repository/allowlists-match.ts';
import { configurationPurity } from '#cli/checks/repository/config-purity.ts';

function tracked(path: string, size = 1): TrackedFile {
    return { path, prefix: Buffer.alloc(0), nature: 'source', tags: ['text'], executable: false, size };
}

function input(root: string, files: TrackedFile[], policy: Partial<Policy>): EngineInput {
    const repository: Partial<Repository> = { files, attributes: readAttributes(root) };
    const policyFiles: Partial<Session['policyFiles']> = { policy: policy as Policy };
    const session: Partial<Session> = {
        repository: repository as Repository,
        policyFiles: policyFiles as Session['policyFiles'],
        scopes: [],
    };
    const view: Partial<MergedView> = { limit: () => undefined, tool: () => ({}) };
    const spec: Partial<CheckSpec> = { name: 'integrity/test' };
    const partial: Partial<EngineInput> = {
        root,
        scope: '',
        spec: spec as CheckSpec,
        files,
        session: session as Session,
        view: view as MergedView,
    };
    return partial as EngineInput;
}

const naming: Partial<NamingSettings> = { rules: [] };

const policy: Partial<Policy> = {
    ignores: [{ check: 'x/y', paths: ['gone/**'], reason: 'A test reason.' }],
    declares: [{ paths: ['data/**'] }],
    structure: {
        reexports: 'none',
        call_through_allowed: [],
        trivial_allowed: [],
        single_file_folder_allowed: [{ paths: ['src'], reason: 'A test reason.' }],
        prefix_collision_allowed: [],
        folder_name_allowed: [],
        python: {},
    },
    naming: naming as NamingSettings,
    tools: { docs: { paths_allowed: [{ patterns: ['docs/**'], reason: 'A test reason.' }] } },
    architecture: { elements: [], edges_allowed: [], roles: { config: 'config' }, contracts: [] },
};

describe('the repository-shape analyses', () => {
    test('suppressions are counted from comments only and a missing reason is its own rule', async () => {
        await using sandbox = await createSandbox({
            'a.ts': 'const marker = /eslint-disable/u; // eslint-disable-next-line no-x -- the reason\nlet y; // eslint-disable-line\n',
            'b.sh': '# shellcheck disable=SC2086 # reason: the split is wanted\necho x # nosemgrep\n',
        });
        const found = await suppressions(input(sandbox.path, [tracked('a.ts'), tracked('b.sh')], policy));
        expect(found.map((finding) => `${finding.file}:${String(finding.line)} ${finding.rule ?? ''}`)).toEqual([
            'a.ts:1 eslint-disable',
            'a.ts:2 eslint-disable-no-reason',
            'b.sh:1 shellcheck-disable',
            'b.sh:2 nosemgrep',
        ]);
    });

    test('a policy pattern that names nothing tracked is reported, a folder or glob that does is not', async () => {
        await using sandbox = await createSandbox({ 'src/a.ts': '', 'data/x.bin': '', 'docs/a.md': '' });
        const files = [tracked('src/a.ts'), tracked('data/x.bin'), tracked('docs/a.md')];
        const found = await allowlistsMatch(input(sandbox.path, files, policy));
        expect(found.map((finding) => finding.message)).toEqual([
            'gone/** under [[ignore]] matches no tracked file or folder.',
        ]);
    });

    test('a file over the limit that is neither declared nor under LFS is reported', async () => {
        await using sandbox = await createSandbox({ 'big.bin': '', 'data/big.bin': '' });
        const files = [tracked('big.bin', 2_000_000), tracked('data/big.bin', 2_000_000), tracked('small.txt', 10)];
        const found = await largeFiles(input(sandbox.path, files, policy));
        expect(found.map((finding) => finding.file)).toEqual(['big.bin']);
    });

    test('a configuration module with a function or a call is reported; literals pass', async () => {
        await using sandbox = await createSandbox({
            'config/pure.ts':
                "import type { X } from '#types/x.ts';\n\nexport const NAMES: X[] = ['a'];\nexport const PATTERN = /a/u;\nexport const RAW = String.raw`\\d+`;\n",
            'config/logic.ts':
                "import { readFileSync } from 'node:fs';\n\nexport const text = readFileSync('x', 'utf8');\nexport const pick = (value: string): string => value;\n",
        });
        const files = [tracked('config/pure.ts'), tracked('config/logic.ts')];
        const found = await configurationPurity(input(sandbox.path, files, policy));
        expect(found.map((finding) => `${finding.file}:${String(finding.line)}`)).toEqual([
            'config/logic.ts:1',
            'config/logic.ts:3',
            'config/logic.ts:4',
        ]);
    });
});
