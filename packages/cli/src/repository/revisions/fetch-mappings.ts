// The objects a remote's fetch mappings already brought into the repository, which a push need not re-check.
import { run } from '#cli/platform/spawn.ts';
import { SelectionError } from '#cli/configurations/select.ts';
import { gitLines, gitText } from '#cli/repository/revisions/git-queries.ts';
import type { FetchRules, ParsedMapping } from '#cli/types/repository/revisions.ts';

const GIT_TIMEOUT_MS = 30_000;

// The text a wildcard pattern captures from a ref, '' for an exact match, or undefined when the ref does not match.
function capturedRef(pattern: string, ref: string): string | undefined {
    const star = pattern.indexOf('*');
    if (star === -1) return pattern === ref ? '' : undefined;
    const prefix = pattern.slice(0, star);
    const suffix = pattern.slice(star + 1);
    const isMatch = ref.startsWith(prefix) && ref.endsWith(suffix) && ref.length >= prefix.length + suffix.length;
    return isMatch ? ref.slice(prefix.length, ref.length - suffix.length) : undefined;
}

// Asks Git whether a pattern is a valid refspec, failing the selection when it is not.
async function assertRefspec(root: string, pattern: string, cancelSignal?: AbortSignal): Promise<void> {
    await gitText(root, ['check-ref-format', '--refspec-pattern', pattern], cancelSignal);
}

// A fetch mapping split into its source and destination, or why it cannot be used.
function splitMapping(raw: string): ParsedMapping {
    const fields = raw.replace(/^\+/u, '').split(':');
    const [source, destination] = fields;
    if (destination === undefined || destination === '') return { kind: 'skip' };
    if (fields.length !== 2 || source === undefined) return { kind: 'unusable' };
    if (!source.startsWith('refs/') || !destination.startsWith('refs/')) return { kind: 'unusable' };
    return { kind: 'mapping', source, destination };
}

// Adds one negative refspec to the rules, or returns false when it names no ref namespace.
async function addExclusion(
    root: string,
    raw: string,
    rules: FetchRules,
    cancelSignal?: AbortSignal,
): Promise<boolean> {
    const source = raw.slice(1);
    if (!source.startsWith('refs/')) return false;
    await assertRefspec(root, source, cancelSignal);
    rules.excluded.push(source);
    return true;
}

// Adds one positive refspec to the rules, or returns false when it cannot be used.
async function addMapping(
    root: string,
    remote: string,
    raw: string,
    rules: FetchRules,
    cancelSignal?: AbortSignal,
): Promise<boolean> {
    const parsed = splitMapping(raw);
    if (parsed.kind === 'skip') return true;
    if (parsed.kind === 'unusable') return false;
    await assertRefspec(root, parsed.source, cancelSignal);
    await assertRefspec(root, parsed.destination, cancelSignal);
    if (parsed.source.includes('*') !== parsed.destination.includes('*'))
        throw new SelectionError([`Invalid fetch mapping for ${remote}: ${raw}`]);
    rules.mappings.push({ source: parsed.source, destination: parsed.destination });
    return true;
}

// The rules a remote's fetch configuration declares, or undefined when any entry cannot be used.
async function fetchRules(
    root: string,
    remote: string,
    entries: string[],
    cancelSignal?: AbortSignal,
): Promise<FetchRules | undefined> {
    const rules: FetchRules = { mappings: [], excluded: [] };
    for (const raw of entries) {
        const added = raw.startsWith('^')
            ? await addExclusion(root, raw, rules, cancelSignal)
            : await addMapping(root, remote, raw, rules, cancelSignal);
        if (!added) return undefined;
    }
    return rules;
}

// Whether a local ref is one a fetch mapping writes and no exclusion takes back.
function isFetched(rules: FetchRules, ref: string): boolean {
    return rules.mappings.some(({ source, destination }) => {
        const capture = capturedRef(destination, ref);
        if (capture === undefined) return false;
        const original = source.replace('*', () => capture);
        return !rules.excluded.some((pattern) => capturedRef(pattern, original) !== undefined);
    });
}

// The remote's fetch configuration entries, or undefined when it declares none.
async function fetchEntries(root: string, remote: string, cancelSignal?: AbortSignal): Promise<string[] | undefined> {
    const configured = await run(['git', 'config', '--null', '--get-all', `remote.${remote}.fetch`], {
        cwd: root,
        timeoutMs: GIT_TIMEOUT_MS,
        ...(cancelSignal === undefined ? {} : { cancelSignal }),
    });
    if (configured.code === 1) return undefined;
    if (configured.code !== 0)
        throw new SelectionError([`Cannot read fetch mappings for ${remote}: ${configured.stderr.trim()}`]);
    return configured.stdout.split('\0').filter(Boolean);
}

/**
 * The objects the remote's fetch mappings placed in the repository, each named once.
 * @param root the repository root
 * @param remote the remote name, when Git gave one
 * @param cancelSignal cancellation for the Git commands
 * @returns the fetched objects, or none when the mappings cannot be read as a whole
 */
export async function fetchedObjects(
    root: string,
    remote: string | undefined,
    cancelSignal?: AbortSignal,
): Promise<string[]> {
    if (remote === undefined) return [];
    const entries = await fetchEntries(root, remote, cancelSignal);
    if (entries === undefined) return [];
    const rules = await fetchRules(root, remote, entries, cancelSignal);
    if (rules === undefined || rules.mappings.length === 0) return [];
    const refs = await gitLines(root, ['for-each-ref', '--format=%(refname)%09%(objectname)'], cancelSignal);
    const objects = refs.flatMap((line) => {
        const [ref, object] = line.split('\t');
        return ref !== undefined && object !== undefined && isFetched(rules, ref) ? [object] : [];
    });
    return [...new Set(objects)];
}
