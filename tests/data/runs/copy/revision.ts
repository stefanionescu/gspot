/**
 * A Git hook that copies each revision and reports its files and its own Git folder, with the inherited Git
 * environment.
 */
export const GIT_HOOK_SCRIPT = String.raw`
import { join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const { copyRevision } = await import(process.argv[2]);
const { runGit, runGitForBytes, runGitBlocking, readGitText } = await import(process.argv[3]);
const { runTool } = await import(process.argv[4]);
const root = process.cwd();
const nested = join(root, 'nested');
const gitDir = (await readGitText(root, ['rev-parse', '--absolute-git-dir'], {})).replace(/\n$/u, '');
const index = resolve(root, process.env.GIT_INDEX_FILE);
const head = readFileSync(join(gitDir, 'HEAD'));
const indexed = readFileSync(index);
const hash = (await readGitText(root, ['rev-parse', 'HEAD'], {})).trim();
const reports = [];
for (const source of [{ kind: 'index' }, { kind: 'commit', hash }]) {
    using copy = await copyRevision(nested, source);
    const folder = (await readGitText(copy.root, ['rev-parse', '--absolute-git-dir'], {})).trim();
    const bytes = await runGitForBytes(copy.root, ['ls-files', '-z'], {});
    const tool = await runTool(['git', 'rev-parse', '--absolute-git-dir'], { cwd: copy.root, timeoutSeconds: Number(process.argv[5]) });
    const configured = runGitBlocking(copy.root, ['config', '--get', 'gspot.boundary'], {});
    const intentional = runGitBlocking(copy.root, ['config', '--get', 'gspot.explicit'], {
        env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'gspot.explicit', GIT_CONFIG_VALUE_0: 'caller' },
    });
    const controller = new AbortController();
    controller.abort(new Error('hook cancellation'));
    const cancelled = await runGit(copy.root, ['rev-parse', 'HEAD'], { cancelSignal: controller.signal });
    reports.push({
        kind: source.kind,
        source: readFileSync(join(copy.root, 'source.txt'), 'utf8'),
        tree: copy.tree === (await readGitText(copy.root, ['write-tree'], {})).trim(),
        ownMetadata: folder !== gitDir,
        toolMetadata: tool.stdout.trim() === folder,
        paths: Buffer.from(bytes.stdout).toString('utf8').split('\0').filter(Boolean),
        configuration: configured.stdout.trim(),
        explicit: intentional.stdout.trim(),
        cancelled: cancelled.canceled === true && cancelled.code !== 0,
    });
}
writeFileSync(process.argv[6], JSON.stringify({
    reports,
    headRetained: readFileSync(join(gitDir, 'HEAD')).equals(head),
    indexRetained: readFileSync(index).equals(indexed),
    workingBytes: readFileSync(join(nested, 'source.txt'), 'utf8'),
}));
`;

/** The hook must keep both revision copies, the explicit Git setting, and the `HEAD` and index of the source. */
export const GIT_HOOK_REPORT = {
    reports: [
        {
            kind: 'index',
            source: 'selected\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
        {
            kind: 'commit',
            source: 'committed\n',
            tree: true,
            ownMetadata: true,
            toolMetadata: true,
            paths: ['source.txt'],
            configuration: 'inherited',
            explicit: 'caller',
            cancelled: true,
        },
    ],
    headRetained: true,
    indexRetained: true,
    workingBytes: 'working\n',
} as const;

export const GIT_HOOK_CASES = [
    { part: 'environment', name: 'a Git hook keeps the inherited environment in both revision copies' },
    { part: 'index', name: 'a hook in a linked worktree keeps its own index' },
    { part: 'HEAD', name: 'a hook in a linked worktree keeps its own HEAD' },
    { part: 'cancellation', name: 'a Git hook reports cancellation in both revision copies' },
] as const;

export const GIT_HOOK_FIELDS = {
    environment: ['kind', 'ownMetadata', 'toolMetadata', 'configuration', 'explicit'],
    index: ['kind', 'source', 'tree', 'paths'],
    cancellation: ['kind', 'cancelled'],
} as const;
