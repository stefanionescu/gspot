// Staged files for the commit stage, and the honest note about unstaged changes.
import { run } from '#cli/platform/spawn.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { gitLines, gitPaths, gitValue, isShallow } from '#cli/repository/revisions/git-queries.ts';

const GIT_TIMEOUT_MS = 30_000;
const CHANGED_PATHS = ['diff', '--relative', '--name-only', '--no-renames', '-z'];

// The paths with unstaged or uncommitted changes in the working tree.
async function workingPaths(root: string, cancelSignal?: AbortSignal): Promise<string[]> {
    return gitPaths(root, CHANGED_PATHS, cancelSignal);
}

// The upstream of the current branch, or '' when it has none.
async function upstreamOf(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = await gitValue(root, ['rev-parse', '--symbolic-full-name', 'HEAD'], cancelSignal);
    return gitValue(root, ['for-each-ref', '--format=%(upstream)', '--', head], cancelSignal);
}

// The remote HEAD symrefs, as pairs of the ref name and the branch it points to.
async function remoteHeads(root: string, cancelSignal?: AbortSignal): Promise<[string, string][]> {
    const lines = await gitLines(
        root,
        ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'],
        cancelSignal,
    );
    return lines.flatMap((line) => {
        const [name, target] = line.split('\t');
        const isHead = name !== undefined && name.endsWith('/HEAD') && target !== undefined && target !== '';
        return isHead ? [[name, target] as [string, string]] : [];
    });
}

// The ref a comparison falls back to: the upstream, origin's default branch, or the one remote's default branch.
async function defaultReference(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const upstream = await upstreamOf(root, cancelSignal);
    if (upstream !== '') return upstream;
    const heads = await remoteHeads(root, cancelSignal);
    const preferred =
        heads.find(([name]) => name === 'refs/remotes/origin/HEAD') ?? (heads.length === 1 ? heads[0] : undefined);
    if (preferred !== undefined) return preferred[1];
    throw new SelectionError(['No upstream or default branch is available; use --changed=<ref>.']);
}

// The merge base of a ref and HEAD, with a note about cut history when the repository is shallow.
async function mergeBase(root: string, compared: string, cancelSignal?: AbortSignal): Promise<string> {
    const base = await run(['git', 'merge-base', '--', compared, 'HEAD'], {
        cwd: root,
        timeoutMs: GIT_TIMEOUT_MS,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (base.code === 0) return base.stdout.trim();
    const help = (await isShallow(root, cancelSignal)) ? ' History is cut; run git fetch --unshallow.' : '';
    throw new SelectionError([`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the staged paths, sorted, and the unstaged count
 */
export async function stagedFiles(root: string, cancelSignal?: AbortSignal): Promise<StagedSet> {
    const cached = await gitPaths(
        root,
        ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'],
        cancelSignal,
    );
    const staged = cached.toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await workingPaths(root, cancelSignal));
    return { staged, unstaged: staged.filter((path) => dirty.has(path)).length };
}

/**
 * Files changed relative to a ref, for the pull-request form.
 * @param root the repository root
 * @param reference the git ref to compare against
 * @param cancelSignal cancellation for the Git commands
 * @returns the selected reference and sorted paths
 */
export async function changedFiles(root: string, reference: string, cancelSignal?: AbortSignal): Promise<ChangedSet> {
    const compared = reference === '' ? await defaultReference(root, cancelSignal) : reference;
    const merged = await mergeBase(root, compared, cancelSignal);
    const committed = await gitPaths(root, [...CHANGED_PATHS, merged, '--'], cancelSignal);
    const working = await workingPaths(root, cancelSignal);
    return {
        reference: compared,
        paths: [...new Set([...committed, ...working])].toSorted((a, b) => a.localeCompare(b)),
    };
}

/**
 * Where a push starts: the merge base with the upstream branch, or the root commit when the branch has none.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the commit the pushed range starts after
 */
export async function pushBase(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const upstream = await upstreamOf(root, cancelSignal);
    if (upstream !== '') return gitValue(root, ['merge-base', '--', 'HEAD', upstream], cancelSignal);
    const roots = await gitLines(root, ['rev-list', '--max-parents=0', 'HEAD'], cancelSignal);
    const first = roots.at(-1);
    if (first === undefined || first === '') throw new Error('Git did not return a root commit for HEAD.');
    return first;
}

export type ChangedSet = { reference: string; paths: string[] };

export type StagedSet = { staged: string[]; unstaged: number };
