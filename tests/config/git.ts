const INVALID_PATH_PREFIX = '100644 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0\t';

const SHA1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

const SHA256 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

const BINARY_BLOB = [0, 10, 255, 13, 0] as const;

const ENTRY_PATH = 'folder/a\n"é.sql';

const ENTRY_FAILURE =
    'The Git entry is unsupported or conflicted. Resolve index conflicts before checking this revision.';

const INVALID_ENTRIES = [
    {
        message: 'The Git entry stream is incomplete.',
        name: 'missing NUL terminator',
        output: `100644 ${SHA1} 0\tsource.ts`,
    },
    { message: ENTRY_FAILURE, name: 'unmerged index stage', output: `100644 ${SHA1} 1\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'unsupported mode', output: `100600 ${SHA1} 0\tsource.ts\0` },
    { message: ENTRY_FAILURE, name: 'short object ID', output: '100644 aaaa 0\tsource.ts\0' },
    { message: ENTRY_FAILURE, name: 'empty path', output: `100644 ${SHA1} 0\t\0` },
    {
        name: 'invalid UTF-8 path',
        message: 'Revision paths must be valid UTF-8.',
        output: { prefix: INVALID_PATH_PREFIX, bytes: [255, 0] },
    },
] as const;

const BLOB_FAILURE = 'The Git object stream is incomplete or invalid.';

const INVALID_BLOBS = [
    { message: BLOB_FAILURE, name: 'missing header terminator', output: `${SHA1} blob 0` },
    { message: BLOB_FAILURE, name: 'wrong object identity', output: `${SHA256} blob 0\n\n` },
    { message: BLOB_FAILURE, name: 'non-blob object', output: `${SHA1} tree 0\n\n` },
    { message: BLOB_FAILURE, name: 'missing object', output: `${SHA1} missing\n` },
    { message: BLOB_FAILURE, name: 'unsafe byte count', output: `${SHA1} blob 9007199254740992\n\n` },
    { message: BLOB_FAILURE, name: 'truncated content', output: `${SHA1} blob 3\nab\n` },
    { message: BLOB_FAILURE, name: 'missing body terminator', output: `${SHA1} blob 2\nab` },
    { message: BLOB_FAILURE, name: 'incorrect body terminator', output: `${SHA1} blob 2\nabx` },
    {
        message: 'The Git object stream contains unexpected data.',
        name: 'trailing response data',
        output: `${SHA1} blob 0\n\nextra`,
    },
] as const;

/** Authored source and conflicting working-tree bytes used by native and command push selection. */
const PUSH_CONTENT = {
    base: 'echo base\n',
    reviewed: 'echo reviewed\n',
    broken: 'if then\n',
    working: 'echo repaired only in the working tree\n',
    settings: 'invalid working policy',
} as const;

/** Repository context and a nested policy's committed source for entry and push selection. */
const NESTED_SCOPE_FILES = {
    'outside.txt': 'repository context',
    'nested policy/source.txt': 'committed',
} as const;

const PUSH_CHECK_ARGV = ['check', '--hook', 'pre-push', '--only', 'project/bash-syntax', '--json', '--'] as const;

const PUSH_CHECK_COMMAND = [...PUSH_CHECK_ARGV, 'origin', 'unused'] as const;

/** The real hook reports revision behavior and retained metadata from its inherited Git environment. */
const GIT_HOOK_SCRIPT = String.raw`
import { join, resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
const { copyRevision } = await import(process.argv[2]);
const { runGit, runGitForBytes, runGitBlocking, gitText } = await import(process.argv[3]);
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
    await copyRevision(nested, source, async (checkout, tree) => {
        const folder = (await gitText(checkout, ['rev-parse', '--absolute-git-dir'])).trim();
        const bytes = await runGitForBytes(checkout, ['ls-files', '-z']);
        const tool = await runTool(['git', 'rev-parse', '--absolute-git-dir'], { cwd: checkout, timeoutSeconds: Number(process.argv[5]) });
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
writeFileSync(process.argv[6], JSON.stringify({
    reports,
    headRetained: readFileSync(join(gitDir, 'HEAD')).equals(head),
    indexRetained: readFileSync(index).equals(indexed),
    workingBytes: readFileSync(join(nested, 'source.txt'), 'utf8'),
}));
`;

/** The hook must preserve both revision views, explicit configuration, and source metadata. */
const GIT_HOOK_REPORT = {
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

const GIT_TEST_CONFIG = [
    '-c',
    'user.email=t@t',
    '-c',
    'user.name=t',
    '-c',
    'maintenance.auto=false',
    '-c',
    'gc.auto=0',
    '-c',
    'core.autocrlf=false',
] as const;

const GIT_TEST_ENVIRONMENT = { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '' } as const;

const SANDBOX_COMMIT_STEPS = [
    ['init', '-q'],
    ['add', '-A'],
    ['commit', '-qm', 'init'],
] as const;

const GIT_HOOK_CASES = [
    { part: 'environment', name: 'a Git hook keeps the inherited environment in both revision copies' },
    { part: 'index', name: 'a hook in a linked worktree keeps its own index' },
    { part: 'HEAD', name: 'a hook in a linked worktree keeps its own HEAD' },
    { part: 'cancellation', name: 'a Git hook reports cancellation in both revision copies' },
] as const;

export {
    SHA1,
    SHA256,
    ENTRY_PATH,
    BINARY_BLOB,
    PUSH_CONTENT,
    INVALID_BLOBS,
    GIT_HOOK_CASES,
    INVALID_ENTRIES,
    PUSH_CHECK_ARGV,
    GIT_HOOK_SCRIPT,
    GIT_HOOK_REPORT,
    GIT_TEST_CONFIG,
    NESTED_SCOPE_FILES,
    PUSH_CHECK_COMMAND,
    GIT_TEST_ENVIRONMENT,
    SANDBOX_COMMIT_STEPS,
};

export const GIT_HOOK_FIELDS = {
    environment: ['kind', 'ownMetadata', 'toolMetadata', 'configuration', 'explicit'],
    index: ['kind', 'source', 'tree', 'paths'],
    cancellation: ['kind', 'cancelled'],
} as const;

export const TOOL_PROJECT_BYTE_ATTRIBUTES = '\n.gspot/* -text\n';
