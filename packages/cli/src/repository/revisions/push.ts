// The revisions a push sends, resolved from the ref and object pairs Git hands the pre-push hook.
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import { GspotError } from '#cli/platform/errors.ts';
import { HASH_PATTERN } from '#cli/config/parsers/git.ts';
import { runGit, gitText, gitLines, gitPaths, isShallow } from '#cli/platform/git.ts';
import { LOG_ARGV, ABSENT_HASH, REFSPEC_FIELDS, COMMIT_DIFF_ARGV } from '#cli/config/repository/revisions.ts';

import type {
    Refspec,
    PushLine,
    RefRules,
    Comparison,
    PushSearch,
    PushRevision,
    PushSelection,
} from '#cli/types/repository/revisions.ts';

// The text a wildcard pattern captures from a ref, '' for an exact match, or undefined when the ref does not match.
function captureRef(pattern: string, ref: string): string | undefined {
    const star = pattern.indexOf('*');
    if (star === -1) return pattern === ref ? '' : undefined;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    const isMatch = ref.startsWith(prefix) && ref.endsWith(suffix) && ref.length >= prefix.length + suffix.length;
    return isMatch ? ref.slice(prefix.length, ref.length - suffix.length) : undefined;
}

// A fetch mapping split into its source and destination, or why it cannot be used.
function parseRefspec(raw: string): Refspec {
    const fields = raw.replace(/^\+/u, '').split(':');
    const [source, destination] = fields;
    if (destination === undefined || destination === '') return { kind: 'skip' };
    if (fields.length !== REFSPEC_FIELDS || source === undefined) return { kind: 'unusable' };
    if (!source.startsWith('refs/') || !destination.startsWith('refs/')) return { kind: 'unusable' };
    return { kind: 'mapping', source, destination };
}

// Adds one negative refspec to the rules, or returns false when it names no ref namespace.
async function addExclusion(
    root: string,
    remote: string,
    raw: string,
    rules: RefRules,
    cancelSignal?: AbortSignal,
): Promise<boolean> {
    const source = raw.slice(1);
    if (!source.startsWith('refs/')) return false;
    const validated = await runGit(root, ['check-ref-format', '--refspec-pattern', source], { cancelSignal });
    if (validated.code !== 0) throw new GspotError('selection', `Invalid fetch mapping for ${remote}: ${raw}`);
    rules.excluded.push(source);
    return true;
}

// Adds one positive refspec to the rules, or returns false when it cannot be used.
async function addMapping(
    root: string,
    remote: string,
    raw: string,
    rules: RefRules,
    cancelSignal?: AbortSignal,
): Promise<boolean> {
    const parsed = parseRefspec(raw);
    if (parsed.kind === 'skip') return true;
    if (parsed.kind === 'unusable') return false;
    for (const pattern of [parsed.source, parsed.destination]) {
        const validated = await runGit(root, ['check-ref-format', '--refspec-pattern', pattern], { cancelSignal });
        if (validated.code !== 0) throw new GspotError('selection', `Invalid fetch mapping for ${remote}: ${raw}`);
    }
    if (parsed.source.includes('*') !== parsed.destination.includes('*'))
        throw new GspotError('selection', [`Invalid fetch mapping for ${remote}: ${raw}`]);
    rules.mappings.push({ source: parsed.source, destination: parsed.destination });
    return true;
}

// The rules a remote's fetch configuration declares, or undefined when any entry cannot be used.
async function getRules(
    root: string,
    remote: string,
    entries: string[],
    cancelSignal?: AbortSignal,
): Promise<RefRules | undefined> {
    const rules: RefRules = { mappings: [], excluded: [] };
    for (const raw of entries) {
        const added = raw.startsWith('^')
            ? await addExclusion(root, remote, raw, rules, cancelSignal)
            : await addMapping(root, remote, raw, rules, cancelSignal);
        if (!added) return undefined;
    }
    return rules;
}

// Whether a local ref is one a fetch mapping writes and no exclusion takes back.
function isFetched(rules: RefRules, ref: string): boolean {
    return rules.mappings.some(({ source, destination }) => {
        const capture = captureRef(destination, ref);
        if (capture === undefined) return false;
        const original = source.replace('*', () => capture);
        return !rules.excluded.some((pattern) => captureRef(pattern, original) !== undefined);
    });
}

// The remote's fetch configuration entries, or undefined when it declares none.
async function getRefspecs(root: string, remote: string, cancelSignal?: AbortSignal): Promise<string[] | undefined> {
    const configured = await runGit(root, ['config', '--null', '--get-all', `remote.${remote}.fetch`], {
        cancelSignal,
    });
    if (configured.code === 1) return undefined;
    if (configured.code !== 0)
        throw new GspotError('selection', [`Cannot read fetch mappings for ${remote}: ${configured.stderr.trim()}`]);
    return configured.stdout.split('\0').filter(Boolean);
}

/**
 * The objects the remote's fetch mappings placed in the repository, each named once.
 * @param root the repository root
 * @param remote the remote name, when Git gave one
 * @param cancelSignal cancellation for the Git commands
 * @returns the fetched objects, or none when the mappings cannot be read as a whole
 */
async function getFetchedObjects(
    root: string,
    remote: string | undefined,
    cancelSignal?: AbortSignal,
): Promise<string[]> {
    if (remote === undefined) return [];
    const entries = await getRefspecs(root, remote, cancelSignal);
    if (entries === undefined) return [];
    const rules = await getRules(root, remote, entries, cancelSignal);
    if (rules === undefined || rules.mappings.length === 0) return [];
    const refs = await gitLines(root, ['for-each-ref', '--format=%(refname)%09%(objectname)'], {
        cancelSignal,
    });
    const hashes = refs.flatMap((line) => {
        const [ref, hash] = line.split('\t');
        return ref !== undefined && hash !== undefined && isFetched(rules, ref) ? [hash] : [];
    });
    return [...new Set(hashes)];
}

// Whether a pre-push field pair holds two object ids of the same hash length.
function isHashPair(localHash: string, remoteHash: string): boolean {
    if (!HASH_PATTERN.test(localHash) || !HASH_PATTERN.test(remoteHash)) return false;
    return localHash.length === remoteHash.length;
}

// One line of pre-push input: two refs and two objects of the same hash length.
function parseLine(line: string): PushLine {
    const [localRef, localHash, remoteRef, remoteHash, ...verbatim] = line.trim().split(/\s+/u);
    const hasRefs = verbatim.length === 0 && localRef !== undefined && remoteRef !== undefined;
    if (!hasRefs || localHash === undefined || remoteHash === undefined || !isHashPair(localHash, remoteHash))
        throw new GspotError('selection', [
            'Invalid Git pre-push input. Supply every local and remote ref/object pair.',
        ]);
    return { localRef, localHash, remoteRef, remoteHash };
}

// The commit an object peels to, or undefined for an object that is not a commit, remembered per object.
async function peelCommit(context: PushSearch, hash: string): Promise<string | undefined> {
    if (context.commits.has(hash)) return context.commits.get(hash);
    const { root, cancelSignal } = context;
    const peeled = await gitText(root, ['rev-parse', '--verify', `${hash}^{}`], { cancelSignal });
    const type = await gitText(root, ['cat-file', '-t', peeled.trim()], { cancelSignal });
    const commit = type.trim() === 'commit' ? peeled.trim() : undefined;
    context.commits.set(hash, commit);
    return commit;
}

// The commits a shallow clone's history stops at.
async function getShallowBoundaries(root: string, cancelSignal?: AbortSignal): Promise<Set<string>> {
    const path = await gitText(root, ['rev-parse', '--git-path', 'shallow'], { cancelSignal });
    const text = await readFile(resolve(root, path.trim()), 'utf8');
    return new Set(text.trim().split('\n'));
}

// The commits the fetched objects name, in the order the mappings listed them.
async function getFetchedCommits(context: PushSearch, remote: string | undefined): Promise<string[]> {
    const hashes = await getFetchedObjects(context.root, remote, context.cancelSignal);
    if (hashes.length === 0) return [];
    const text = await gitText(context.root, ['cat-file', '--batch-check=%(objectname) %(objecttype)'], {
        cancelSignal: context.cancelSignal,
        stdin: hashes.map((hash) => `${hash}^{}`).join('\n') + '\n',
    });
    return text
        .trimEnd()
        .split('\n')
        .flatMap((line, index) => {
            const [hash, type] = line.split(' ');
            if (type === 'missing' || hash === undefined)
                throw new GspotError(
                    'selection',
                    `Cannot resolve fetched object ${hashes[index] ?? ''}. Fetch the remote again.`,
                );
            const commit = type === 'commit' ? hash : undefined;
            const requested = hashes[index];
            if (requested === undefined) throw new Error('Fetched object response has no matching request.');
            context.commits.set(requested, commit);
            return commit === undefined ? [] : [commit];
        });
}

// What a pushed commit is compared against: the remote's commit, or every fetched commit for a new ref.
async function comparison(context: PushSearch, hash: string, remoteHash: string): Promise<Comparison> {
    const { root, cancelSignal, shallow } = context;
    if (!ABSENT_HASH.test(remoteHash)) {
        const previous = await peelCommit(context, remoteHash);
        if (previous === undefined) return { changed: undefined, excluded: [] };
        const changed = await gitPaths(root, [...COMMIT_DIFF_ARGV, previous, hash, '--'], {
            cancelSignal,
        });
        return { changed, excluded: [previous] };
    }
    if (shallow) return { changed: undefined, excluded: [] };
    context.fetched ??= getFetchedCommits(context, context.remote);
    const fetched = await context.fetched;
    if (fetched.length === 0) return { changed: undefined, excluded: [] };
    const excluded = [...new Set(fetched)];
    const changed = await gitPaths(root, [...LOG_ARGV, '--stdin', '--'], {
        cancelSignal,
        stdin: [hash, ...excluded.map((commit) => `^${commit}`)].join('\n') + '\n',
    });
    return { changed, excluded };
}

// The revision a pushed commit forms: its history back to the comparison, its tree, and its changed paths.
async function buildRevision(context: PushSearch, line: PushLine, hash: string): Promise<PushRevision> {
    const { root, cancelSignal, boundaries } = context;
    const { changed, excluded } = await comparison(context, hash, line.remoteHash);
    const history = await gitLines(root, ['rev-list', '--stdin', '--'], {
        cancelSignal,
        stdin: [hash, ...excluded.map((commit) => `^${commit}`)].join('\n') + '\n',
    });
    const tree = await gitText(root, ['rev-parse', '--verify', `${hash}^{tree}`], { cancelSignal });
    const selected = changed === undefined ? undefined : [...new Set(changed)].toSorted((a, b) => a.localeCompare(b));
    return {
        object: hash,
        tree: tree.trim(),
        refs: [line.localRef],
        commits: history,
        historyComplete: !history.some((commit) => boundaries.has(commit)),
        ...(selected === undefined ? {} : { paths: selected }),
    };
}

// Records a revision, merging it into one already recorded with the same tree and paths.
function recordRevision(result: PushSelection, revision: PushRevision): void {
    const duplicate = result.revisions.find(
        (entry) => entry.tree === revision.tree && isDeepStrictEqual(entry.paths, revision.paths),
    );
    if (duplicate === undefined) {
        result.revisions.push(revision);
        return;
    }
    duplicate.refs.push(...revision.refs);
    duplicate.historyComplete &&= revision.historyComplete;
    duplicate.commits = [...new Set([...duplicate.commits, ...revision.commits])];
}

// Records what one pre-push line pushes: a deleted ref, a non-commit object, or a revision.
async function selectLine(context: PushSearch, result: PushSelection, line: PushLine): Promise<void> {
    if (ABSENT_HASH.test(line.localHash)) {
        result.skipped.push({ ref: line.remoteRef, object: line.localHash, reason: 'deleted ref' });
        return;
    }
    const commit = await peelCommit(context, line.localHash);
    if (commit === undefined) {
        result.skipped.push({ ref: line.localRef, object: line.localHash, reason: 'non-commit object' });
        return;
    }
    recordRevision(result, await buildRevision(context, line, commit));
}

/**
 * Resolve the exact objects supplied by Git's pre-push protocol before running source checks.
 * @param root the repository root.
 * @param input the lines Git hands the pre-push hook on standard input.
 * @param remote the remote name, when Git gave one.
 * @param cancelSignal cancellation for the Git commands.
 * @returns the pushed revisions with their commits, and the updates no check applies to.
 */
export async function selectPush(
    root: string,
    input: string,
    remote?: string,
    cancelSignal?: AbortSignal,
): Promise<PushSelection> {
    const shallow = await isShallow(root, { cancelSignal });
    const context: PushSearch = {
        root,
        cancelSignal,
        commits: new Map(),
        remote,
        shallow,
        boundaries: shallow ? await getShallowBoundaries(root, cancelSignal) : new Set<string>(),
    };
    const result: PushSelection = { revisions: [], skipped: [] };
    for (const line of input.split('\n').filter((row) => row.trim() !== ''))
        await selectLine(context, result, parseLine(line));
    return result;
}
