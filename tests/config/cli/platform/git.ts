/** The real hook reports revision behavior and retained metadata from its inherited Git environment. */
export const GIT_HOOK_SCRIPT = String.raw`
import { join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const { checkOutRevision } = await import(process.argv[2]);
const { runGit, runGitBlocking, runGitBinary, gitText } = await import(process.argv[3]);
const { runTool } = await import(process.argv[4]);
const root = process.cwd();
const nested = join(root, 'nested');
const gitDir = (await gitText(root, ['rev-parse', '--absolute-git-dir'])).replace(/\n$/u, '');
const index = resolve(root, process.env.GIT_INDEX_FILE);
const head = readFileSync(join(gitDir, 'HEAD'));
const indexed = readFileSync(index);
const hash = (await gitText(root, ['rev-parse', 'HEAD'])).trim();
const reports = [];
for (const source of [{ kind: 'index' }, { kind: 'commit', hash }]) {
    await checkOutRevision(nested, source, async (checkout, tree) => {
        const folder = (await gitText(checkout, ['rev-parse', '--absolute-git-dir'])).trim();
        const bytes = await runGitBinary(checkout, ['ls-files', '-z']);
        const tool = await runTool(['git', 'rev-parse', '--absolute-git-dir'], { cwd: checkout });
        const configured = runGitBlocking(checkout, ['config', '--get', 'gspot.boundary']);
        const intentional = runGitBlocking(checkout, ['config', '--get', 'gspot.explicit'], {
            env: { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'gspot.explicit', GIT_CONFIG_VALUE_0: 'caller' },
        });
        const controller = new AbortController();
        controller.abort(new Error('hook cancellation'));
        const cancelled = await runGit(checkout, ['rev-parse', 'HEAD'], { cancelSignal: controller.signal });
        reports.push({
            kind: source.kind,
            source: readFileSync(join(checkout, 'source.txt'), 'utf8'),
            tree: tree === (await gitText(checkout, ['write-tree'])).trim(),
            ownMetadata: folder !== gitDir,
            toolMetadata: tool.stdout.trim() === folder,
            paths: Buffer.from(bytes.stdout).toString('utf8').split('\0').filter(Boolean),
            configuration: configured.stdout.trim(),
            explicit: intentional.stdout.trim(),
            cancelled: cancelled.isCanceled === true && cancelled.code !== 0,
        });
    });
}
writeFileSync(process.argv[5], JSON.stringify({
    reports,
    headRetained: readFileSync(join(gitDir, 'HEAD')).equals(head),
    indexRetained: readFileSync(index).equals(indexed),
    workingBytes: readFileSync(join(nested, 'source.txt'), 'utf8'),
}));
`;

/** The hook must preserve both revision views, explicit configuration, and source metadata. */
export const GIT_HOOK_EXPECTED = {
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
};
