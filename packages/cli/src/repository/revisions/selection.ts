import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { run } from '#cli/platform/spawn.ts';
import { SelectionError } from '#cli/configurations/select.ts';
// Staged files for the commit stage, and the honest note about unstaged changes.
import type { PushSelection } from '#cli/repository/revisions/snapshot.ts';

async function observed(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string> {
    const result = await run(['git', ...argv], {
        cwd: root,
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (result.code !== 0) {
        throw new SelectionError([
            `Git ${argv[0] ?? ''} failed in ${root} (exit ${String(result.code)}): ${result.stderr.trim()}`,
        ]);
    }
    return result.stdout;
}

async function paths(root: string, argv: string[], cancelSignal?: AbortSignal): Promise<string[]> {
    return (await observed(root, argv, cancelSignal)).split('\0').filter((path) => path !== '');
}

async function defaultReference(root: string, cancelSignal?: AbortSignal): Promise<string> {
    const head = (await observed(root, ['rev-parse', '--symbolic-full-name', 'HEAD'], cancelSignal)).trim();
    const upstream = (await observed(root, ['for-each-ref', '--format=%(upstream)', '--', head], cancelSignal)).trim();
    if (upstream !== '') return upstream;
    const defaults = (
        await observed(root, ['for-each-ref', '--format=%(refname)%09%(symref)', 'refs/remotes'], cancelSignal)
    )
        .trim()
        .split('\n')
        .map((line) => line.split('\t'))
        .filter(
            ([name, target]) => name !== undefined && name.endsWith('/HEAD') && target !== undefined && target !== '',
        );
    const preferred =
        defaults.find(([name]) => name === 'refs/remotes/origin/HEAD') ??
        (defaults.length === 1 ? defaults[0] : undefined);
    const target = preferred?.[1];
    if (target !== undefined) return target;
    throw new SelectionError(['No upstream or default branch is available; use --changed=<ref>.']);
}

function capturedRef(pattern: string, ref: string): string | undefined {
    const star = pattern.indexOf('*');
    if (star === -1) return pattern === ref ? '' : undefined;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    return ref.startsWith(prefix) && ref.endsWith(suffix) && ref.length >= prefix.length + suffix.length
        ? ref.slice(prefix.length, ref.length - suffix.length)
        : undefined;
}

async function fetchedObjects(root: string, remote: string | undefined, cancelSignal?: AbortSignal): Promise<string[]> {
    if (remote === undefined) return [];
    const configured = await run(['git', 'config', '--null', '--get-all', `remote.${remote}.fetch`], {
        cwd: root,
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (configured.code === 1) return [];
    if (configured.code !== 0)
        throw new SelectionError([`Cannot read fetch mappings for ${remote}: ${configured.stderr.trim()}`]);
    const mappings: { source: string; destination: string }[] = [];
    const excluded: string[] = [];
    for (const raw of configured.stdout.split('\0').filter(Boolean)) {
        if (raw.startsWith('^')) {
            const source = raw.slice(1);
            if (!source.startsWith('refs/')) return [];
            await observed(root, ['check-ref-format', '--refspec-pattern', source], cancelSignal);
            excluded.push(source);
            continue;
        }
        const fields = raw.replace(/^\+/u, '').split(':');
        const [source, destination] = fields;
        if (destination === undefined || destination === '') continue;
        if (
            fields.length !== 2 ||
            source === undefined ||
            !source.startsWith('refs/') ||
            !destination.startsWith('refs/')
        )
            return [];
        await observed(root, ['check-ref-format', '--refspec-pattern', source], cancelSignal);
        await observed(root, ['check-ref-format', '--refspec-pattern', destination], cancelSignal);
        if (source.includes('*') !== destination.includes('*'))
            throw new SelectionError([`Invalid fetch mapping for ${remote}: ${raw}`]);
        mappings.push({ source, destination });
    }
    if (mappings.length === 0) return [];
    const refs = await observed(root, ['for-each-ref', '--format=%(refname)%09%(objectname)'], cancelSignal);
    return [
        ...new Set(
            refs.split('\n').flatMap((line) => {
                const [ref, object] = line.split('\t');
                if (ref === undefined || object === undefined) return [];
                const matches = mappings.some(({ source, destination }) => {
                    const capture = capturedRef(destination, ref);
                    if (capture === undefined) return false;
                    const original = source.replace('*', () => capture);
                    return !excluded.some((pattern) => capturedRef(pattern, original) !== undefined);
                });
                return matches ? [object] : [];
            }),
        ),
    ];
}

/**
 * Staged paths include deletions and both sides of renames. Count paths with unstaged changes.
 * @param root the repository root
 * @param cancelSignal cancellation for the Git commands
 * @returns the staged paths, sorted, and the unstaged count
 */
export async function stagedFiles(root: string, cancelSignal?: AbortSignal): Promise<StagedSet> {
    const staged = (
        await paths(root, ['diff', '--relative', '--cached', '--name-only', '--no-renames', '-z'], cancelSignal)
    ).toSorted((a, b) => a.localeCompare(b));
    const dirty = new Set(await paths(root, ['diff', '--relative', '--name-only', '--no-renames', '-z'], cancelSignal));
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
    const base = await run(['git', 'merge-base', '--', compared, 'HEAD'], {
        cwd: root,
        timeoutMs: 30_000,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (base.code !== 0) {
        const shallow =
            (await observed(root, ['rev-parse', '--is-shallow-repository'], cancelSignal)).trim() === 'true';
        const help = shallow ? ' History is cut; run git fetch --unshallow.' : '';
        throw new SelectionError([`Git merge-base failed for ${compared}: ${base.stderr.trim()}.${help}`]);
    }
    const merged = base.stdout.trim();
    const committed = await paths(
        root,
        ['diff', '--relative', '--name-only', '--no-renames', '-z', merged, '--'],
        cancelSignal,
    );
    const working = await paths(root, ['diff', '--relative', '--name-only', '--no-renames', '-z'], cancelSignal);
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
    const head = (await observed(root, ['rev-parse', '--symbolic-full-name', 'HEAD'], cancelSignal)).trim();
    const upstream = (await observed(root, ['for-each-ref', '--format=%(upstream)', '--', head], cancelSignal)).trim();
    if (upstream !== '') return (await observed(root, ['merge-base', '--', 'HEAD', upstream], cancelSignal)).trim();
    const first = (await observed(root, ['rev-list', '--max-parents=0', 'HEAD'], cancelSignal))
        .trim()
        .split('\n')
        .at(-1);
    if (first === undefined || first === '') throw new Error('Git did not return a root commit for HEAD.');
    return first;
}

/**
 * Resolve the exact objects supplied by Git's pre-push protocol before running source checks.
 * @param root the repository root
 * @param input the lines Git hands the pre-push hook on standard input
 * @param remote the remote name, when Git gave one
 * @param cancelSignal cancellation for the Git commands
 * @returns the pushed revisions with their commits, and the updates no check applies to
 */
export async function pushedRevisions(
    root: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushSelection> {
    const result: PushSelection = { revisions: [], notApplicable: [] };
    const commits = new Map<string, string | undefined>();
    const commitOf = async (object: string): Promise<string | undefined> => {
        if (commits.has(object)) return commits.get(object);
        const peeled = (await observed(root, ['rev-parse', '--verify', `${object}^{}`], cancelSignal)).trim();
        const type = (await observed(root, ['cat-file', '-t', peeled], cancelSignal)).trim();
        const commit = type === 'commit' ? peeled : undefined;
        commits.set(object, commit);
        return commit;
    };
    const fetched: string[] = [];
    for (const stored of await fetchedObjects(root, remote, cancelSignal)) {
        const commit = await commitOf(stored);
        if (commit !== undefined) fetched.push(commit);
    }
    const shallow = (await observed(root, ['rev-parse', '--is-shallow-repository'], cancelSignal)).trim() === 'true';
    const boundaries = shallow
        ? new Set(
              (
                  await readFile(
                      resolve(
                          root,
                          (await observed(root, ['rev-parse', '--git-path', 'shallow'], cancelSignal)).replace(
                              /\n$/u,
                              '',
                          ),
                      ),
                      'utf8',
                  )
              )
                  .trim()
                  .split('\n'),
          )
        : new Set<string>();
    for (const line of input.split('\n').filter((row) => row.trim() !== '')) {
        const fields = line.trim().split(/\s+/u);
        const [localRef, localObject, remoteRef, remoteObject, ...extra] = fields;
        if (
            extra.length > 0 ||
            localRef === undefined ||
            remoteRef === undefined ||
            localObject === undefined ||
            remoteObject === undefined ||
            !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(localObject) ||
            !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(remoteObject) ||
            localObject.length !== remoteObject.length
        )
            throw new SelectionError(['Invalid Git pre-push input. Supply every local and remote ref/object pair.']);
        if (/^0+$/u.test(localObject)) {
            result.notApplicable.push({ ref: remoteRef, object: localObject, reason: 'deleted ref' });
            continue;
        }
        const object = await commitOf(localObject);
        if (object === undefined) {
            result.notApplicable.push({ ref: localRef, object: localObject, reason: 'non-commit object' });
            continue;
        }
        let changed: string[] | undefined;
        let excluded: string[] = [];
        if (!/^0+$/u.test(remoteObject)) {
            const previous = await commitOf(remoteObject);
            if (previous !== undefined) {
                excluded = [previous];
                changed = await paths(
                    root,
                    [
                        'diff',
                        '--relative',
                        '--no-ext-diff',
                        '--name-only',
                        '--no-renames',
                        '-z',
                        previous,
                        object,
                        '--',
                    ],
                    cancelSignal,
                );
            }
        } else if (fetched.length > 0 && !shallow) {
            excluded = [...new Set(fetched)];
            changed = await paths(
                root,
                [
                    'log',
                    '--relative',
                    '--format=',
                    '--name-only',
                    '--no-renames',
                    '--diff-merges=separate',
                    '-z',
                    object,
                    '--not',
                    ...new Set(fetched),
                    '--',
                ],
                cancelSignal,
            );
        }
        const history = (
            await observed(
                root,
                ['rev-list', object, ...(excluded.length === 0 ? [] : ['--not', ...excluded]), '--'],
                cancelSignal,
            )
        )
            .split('\n')
            .filter(Boolean);
        const historyComplete = !history.some((commit) => boundaries.has(commit));
        const selected =
            changed === undefined
                ? undefined
                : [...new Set(changed)].toSorted((left, right) => left.localeCompare(right));
        const tree = (await observed(root, ['rev-parse', '--verify', `${object}^{tree}`], cancelSignal)).trim();
        const duplicate = result.revisions.find(
            (entry) => entry.tree === tree && JSON.stringify(entry.paths) === JSON.stringify(selected),
        );
        if (duplicate === undefined) {
            result.revisions.push({
                object,
                tree,
                refs: [localRef],
                commits: history,
                historyComplete,
                ...(selected === undefined ? {} : { paths: selected }),
            });
        } else {
            duplicate.refs.push(localRef);
            duplicate.historyComplete &&= historyComplete;
            duplicate.commits = [...new Set([...duplicate.commits, ...history])];
        }
    }
    return result;
}

export type ChangedSet = { reference: string; paths: string[] };

export type StagedSet = { staged: string[]; unstaged: number };
