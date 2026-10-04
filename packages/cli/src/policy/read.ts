import type { z } from 'zod';
import { join } from 'node:path';
import { readText } from '#cli/platform/source.ts';
import { valueAt } from '#cli/platform/objects.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#cli/policy/normalize.ts';
import { TomlError, parse as parseToml } from 'smol-toml';
import { policySchema } from '#cli/policy/schema/policy.ts';
import type { KeyPath } from '#cli/types/platform/document.ts';
import { FIELD_PROBLEMS } from '#cli/config/policy/settings.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import type { Policy, RawPolicy, PolicyFile, PolicyProblem } from '#cli/types/policy/settings.ts';
import { completenessProblems, unknownConfigurationProblems } from '#cli/policy/problems/selection.ts';
import { reasonProblems, restrictionProblems, pathProblems as getPathProblems } from '#cli/policy/problems/reasons.ts';

function issueLines(path: string, issue: z.core.$ZodIssue): string[] {
    const segments = issue.path.filter((part): part is KeyPath[number] => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return [problemText({ path: segments, message: issue.message }, path)];
    const where = segments.map(String).join('.');
    return issue.keys.map(
        (key) =>
            `${path}: \`${key}\` is not a setting gspot knows under ${where === '' ? 'the top level' : '[' + where + ']'}. The policy reference (gspot.dev/reference/configuration/) lists every key.`,
    );
}

function throwProblems(problems: PolicyProblem[]): never {
    throw new GspotError(
        'policy',
        problems.map((problem) => problemText(problem, POLICY_FILE)),
    );
}

function validatedRaw(text: string): RawPolicy {
    const result = policySchema.safeParse(parseTomlText(text, POLICY_FILE, 'policy'));
    if (!result.success)
        throw new GspotError(
            'policy',
            result.error.issues.flatMap((issue) => issueLines(POLICY_FILE, issue)),
        );
    return result.data;
}

function normalizeKnownConfigurations(raw: RawPolicy): Policy {
    const policy = buildPolicy(raw);
    const unknown = unknownConfigurationProblems(policy);
    if (unknown.length > 0) throwProblems(unknown);
    return policy;
}

// Strict commands and check execution validate the same effective policy, including after bad entries are removed.
function collectProblems(policy: Policy, root: string | undefined): PolicyProblem[] {
    return [
        ...reasonProblems(policy),
        ...restrictionProblems(policy),
        ...(root === undefined ? [] : getPathProblems(root, policy)),
        ...completenessProblems(policy),
    ];
}

function ownerOf(path: KeyPath): KeyPath {
    const last = path.at(-1);
    return typeof last === 'string' && FIELD_PROBLEMS.has(last) ? path.slice(0, -1) : path;
}

// Deeper owners and later array entries go first, so no removal moves an owner still to be removed.
function byRemovalOrder(left: KeyPath, right: KeyPath): number {
    if (left.length !== right.length) return right.length - left.length;
    const [last, other] = [left.at(-1), right.at(-1)];
    return typeof last === 'number' && typeof other === 'number' ? other - last : 0;
}

// Removes the value an owner path names: an array entry by index, or a table field by key.
function dropOwner(raw: RawPolicy, owner: KeyPath): void {
    const container = valueAt(raw, owner.slice(0, -1));
    const last = owner.at(-1);
    if (container === null || typeof container !== 'object' || last === undefined) return;
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
 * @param text the TOML text
 * @param path the source file or URL, for the error
 * @param kind whether the document is a policy or reusable template
 * @returns the parsed table
 */
export function parseTomlText(text: string, path: string, kind: 'policy' | 'template'): Record<string, unknown> {
    try {
        return parseToml(text);
    } catch (error) {
        if (!(error instanceof TomlError)) throw error;
        const detail = error.message.split('\n', 1).join('').replace('Invalid TOML document: ', '');
        throw new GspotError(kind, [
            `${path}:${String(error.line)}:${String(error.column)} is not valid TOML: ${detail}`,
        ]);
    }
}

/**
 * Parses and validates gspot.toml. Throws GspotError('policy') with every problem found.
 *
 * @param text the file's text
 * @param root the repository root, when scopes are to be checked against the file system
 * @returns the normalized policy
 */
export function parseStrictPolicy(text: string, root?: string): Policy {
    const policy = normalizeKnownConfigurations(validatedRaw(text));
    const problems = collectProblems(policy, root);
    if (problems.length > 0) throwProblems(problems);
    return policy;
}

/**
 * Reads policy for check execution. Invalid values become findings and are excluded from the effective policy.
 * Syntax errors, unknown keys, and invalid document shapes throw GspotError('policy').
 *
 * @param text the file's text.
 * @param root the repository root, when scopes are to be checked against the file system.
 * @returns the policy without invalid entries, and each located problem.
 */
export function readPolicyText(text: string, root?: string): Pick<PolicyFile, 'policy' | 'problems'> {
    const raw = validatedRaw(text);
    const complete = normalizeKnownConfigurations(raw);
    const found = collectProblems(complete, root);

    if (found.length === 0) return { policy: complete, problems: [] };
    // A configurations list is settled by a root value, never by dropping the list.
    if (found.some((problem) => ownerOf(problem.path).at(-1) === 'configurations')) throwProblems(found);
    const owners = new Map(found.map((problem) => [JSON.stringify(ownerOf(problem.path)), ownerOf(problem.path)]));
    for (const owner of [...owners.values()].toSorted(byRemovalOrder)) dropOwner(raw, owner);
    const policy = normalizeKnownConfigurations(raw);
    const remaining = collectProblems(policy, root);
    if (remaining.length > 0) throwProblems(remaining);
    return { policy, problems: found };
}

/**
 * Refuses a policy that check reads with findings: a command that writes from the policy needs every line right.
 * @param files the policy as read
 */
export function assertNoProblems(files: PolicyFile): void {
    if (files.problems.length === 0) return;
    throwProblems(files.problems);
}

/**
 * True when a root has a gspot.toml.
 * @param root the repository root
 * @returns whether the file is there
 */
export function hasPolicy(root: string): boolean {
    return readText(root, POLICY_FILE) !== undefined;
}

/**
 * Loads gspot.toml from a repository root.
 * @param root the repository root
 * @returns the policy and the file's path and text
 */
export function readPolicy(root: string): PolicyFile {
    const path = join(root, POLICY_FILE);
    const text = readText(root, POLICY_FILE);
    if (text === undefined)
        throw new GspotError('policy', [`There is no gspot.toml here. Run \`gspot init\` to create one.`]);
    const { policy, problems } = readPolicyText(text, root);
    return { policy, path, text, problems };
}
