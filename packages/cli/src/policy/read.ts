import type { z } from 'zod';
import { join } from 'node:path';
import * as messages from '#cli/policy/messages.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { normalize } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/policy/schema.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { reasonProblems } from '#cli/policy/problems.ts';
import { TomlError, parse as parseToml } from 'smol-toml';
import { pathProblems } from '#cli/policy/path-problems.ts';
import { FIELD_PROBLEMS } from '#cli/config/policy/policy.ts';
import { unknownKitProblems, completenessProblems } from '#cli/policy/validate.ts';
import type { Policy, RawPolicy, PathSegment, PolicyFiles, PolicyProblem } from '#cli/types/policy/policy.ts';

function issueLines(path: string, issue: z.core.$ZodIssue): string[] {
    const segments = issue.path.filter((part): part is PathSegment => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return [problemText({ path: segments, message: issue.message }, path)];
    const where = segments.map(String).join('.');
    return issue.keys.map((key) => `${path}: ${messages.unknownKey(where, key)}`);
}

function validatedRaw(text: string, path: string): RawPolicy {
    const result = policySchema.safeParse(parseTomlText(text, path));
    if (!result.success)
        throw new GspotError(
            'policy',
            result.error.issues.flatMap((issue) => issueLines(path, issue)),
        );
    return result.data;
}

function completePolicy(path: string, raw: RawPolicy): Policy {
    const policy = normalize(raw);
    const unknown = unknownKitProblems(policy);
    if (unknown.length > 0)
        throw new GspotError(
            'policy',
            unknown.map((problem) => problemText(problem, path)),
        );
    return policy;
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Three steps of recovery find the entry that owns a field problem; the field set is applied in one place.
function ownerOf(path: PathSegment[]): PathSegment[] {
    const last = path.at(-1);
    return typeof last === 'string' && FIELD_PROBLEMS.has(last) ? path.slice(0, -1) : path;
}

// Deeper owners and later array entries go first, so no removal moves an owner still to be removed.
function byRemovalOrder(left: PathSegment[], right: PathSegment[]): number {
    if (left.length !== right.length) return right.length - left.length;
    const [last, other] = [left.at(-1), right.at(-1)];
    return typeof last === 'number' && typeof other === 'number' ? other - last : 0;
}

// The table or array that holds the value at a path, or undefined when the path leaves the document.
function containerOf(raw: RawPolicy, path: PathSegment[]): object | undefined {
    let container: unknown = raw;
    for (const segment of path) {
        if (typeof container !== 'object' || container === null) return undefined;
        container = (container as Record<PathSegment, unknown>)[segment];
    }
    return typeof container === 'object' && container !== null ? container : undefined;
}

// Removes the value an owner path names: an array entry by index, or a table field by key.
function dropOwner(raw: RawPolicy, owner: PathSegment[]): void {
    const container = containerOf(raw, owner.slice(0, -1));
    const last = owner.at(-1);
    if (container === undefined || last === undefined) return;
    if (Array.isArray(container)) {
        if (typeof last === 'number') container.splice(last, 1);
        return;
    }
    if (typeof last === 'string') Reflect.deleteProperty(container, last);
}

/**
 * A policy problem as text that leads with its file, when given, and the key path it names.
 * @param problem the problem
 * @param file the policy file, for a line that names it
 * @returns the text
 */
export function problemText(problem: PolicyProblem, file?: string): string {
    const where = problem.path.map(String).join('.');
    const place = [file, where].filter((part) => part !== undefined && part !== '');
    return [...place, problem.message].join(': ');
}

/**
 * Parse TOML and retain the parser location in policy errors.
 *
 * @param text the policy text
 * @param path the policy file, for the error
 * @returns the parsed table
 */
export function parseTomlText(text: string, path: string): Record<string, unknown> {
    try {
        return parseToml(text);
    } catch (error) {
        if (!(error instanceof TomlError)) throw error;
        const detail = error.message.split('\n', 1).join('').replace('Invalid TOML document: ', '');
        throw new GspotError('policy', [
            messages.tomlSyntax(`${path}:${String(error.line)}:${String(error.column)}`, detail),
        ]);
    }
}

/**
 * Parses and validates the text of a gspot.toml. Throws PolicyError with every problem found.
 *
 * @param text the file's text
 * @param path the file's name, for messages
 * @param root the repository root, when scopes are to be checked against the file system
 * @returns the normalized policy
 */
export function parsePolicyText(text: string, path: string, root?: string): Policy {
    const policy = normalize(validatedRaw(text, path));
    const problems = [...reasonProblems(policy), ...(root === undefined ? [] : pathProblems(root, policy))];
    if (problems.length > 0)
        throw new GspotError(
            'policy',
            problems.map((problem) => problemText(problem, path)),
        );
    return policy;
}

/**
 * Reads policy for check execution. Invalid values become findings and are excluded from the effective policy.
 * Syntax errors, unknown keys, and invalid document shapes throw `PolicyError`.
 *
 * @param text the file's text.
 * @param path the file's name, for messages.
 * @param root the repository root, when scopes are to be checked against the file system.
 * @returns the policy without the wrong entries, and one finding per wrong entry.
 */
export function readPolicyText(
    text: string,
    path: string,
    root?: string,
): { policy: Policy; problems: PolicyProblem[] } {
    const raw = validatedRaw(text, path);
    const complete = completePolicy(path, raw);
    // One finding per wrong value: a refused reason is also a loosening without one, and the entry is the same.
    const found = [
        ...new Map(
            [
                ...reasonProblems(complete),
                ...(root === undefined ? [] : pathProblems(root, complete)),
                ...completenessProblems(complete),
            ].map((problem) => [JSON.stringify(ownerOf(problem.path)), problem]),
        ).values(),
    ];

    if (found.length === 0) return { policy: complete, problems: [] };
    // A configurations list is settled by a root value, never by dropping the list.
    if (found.some((problem) => ownerOf(problem.path).at(-1) === 'kits'))
        throw new GspotError(
            'policy',
            found.map((problem) => problemText(problem, path)),
        );
    const owners = new Map(found.map((problem) => [JSON.stringify(ownerOf(problem.path)), ownerOf(problem.path)]));
    for (const owner of [...owners.values()].toSorted(byRemovalOrder)) dropOwner(raw, owner);
    const policy = completePolicy(path, raw);
    const remaining = [
        ...reasonProblems(policy),
        ...(root === undefined ? [] : pathProblems(root, policy)),
        ...completenessProblems(policy),
    ];
    if (remaining.length > 0)
        throw new GspotError(
            'policy',
            remaining.map((problem) => problemText(problem, path)),
        );
    return { policy, problems: found };
}

/**
 * Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any.
 * @param source the parsed policy and its authored text
 */
export function assertPolicyComplete(source: Pick<PolicyFiles, 'policy' | 'text' | 'path'>): void {
    const unknown = unknownKitProblems(source.policy);
    if (unknown.length > 0)
        throw new GspotError(
            'policy',
            unknown.map((problem) => problemText(problem, source.path)),
        );
    const problems = completenessProblems(source.policy);
    if (problems.length > 0)
        throw new GspotError('policy', [...new Set(problems.map((problem) => problemText(problem, source.path)))]);
}

/**
 * Refuses a policy that check reads with findings: a command that writes from the policy needs every line right.
 * @param files the policy as read
 */
export function assertNoProblems(files: PolicyFiles): void {
    if (files.problems.length === 0) return;
    throw new GspotError(
        'policy',
        files.problems.map((problem) => problemText(problem, 'gspot.toml')),
    );
}

/**
 * True when a root has a gspot.toml.
 * @param root the repository root
 * @returns whether the file is there
 */
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Explain, init, and tool inspection decide that a folder has a policy the same way.
export function hasPolicy(root: string): boolean {
    return openRoot(root).read('gspot.toml') !== undefined;
}

/**
 * Loads gspot.toml from a repository root.
 * @param root the repository root
 * @returns the policy and the file's path and text
 */
export function readPolicy(root: string): PolicyFiles {
    const path = join(root, 'gspot.toml');
    const current = openRoot(root).read('gspot.toml');
    if (current === undefined) throw new GspotError('policy', [messages.fileMissing('gspot.toml')]);
    const text = current.bytes.toString('utf8');
    const { policy, problems } = readPolicyText(text, 'gspot.toml', root);
    return { policy, path, text, problems };
}
