import type { z } from 'zod';
import { join } from 'node:path';
import * as messages from '#cli/policy/messages.ts';
import { normalize } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/policy/schema.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { RawPolicy } from '#cli/policy/schema.ts';
import { knownKeysAt } from '#cli/policy/json-schema.ts';
import { parse as parseToml, TomlError } from 'smol-toml';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { pathProblems, reasonProblems } from '#cli/policy/problems.ts';
import type { PathSegment, PolicyProblem } from '#cli/policy/problems.ts';
import { completenessProblems, unknownConfigurationProblems } from '#cli/policy/validate.ts';
import { policyLocation, policyPosition, sourceLocations } from '#cli/policy/source-locations.ts';

function issueText(issue: z.core.$ZodIssue): string {
    const where = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
        const path = issue.path.filter((segment): segment is PathSegment => typeof segment !== 'symbol');
        const known = knownKeysAt(path);
        return issue.keys.map((key) => messages.unknownKey(where, key, known)).join('\n');
    }
    const shown = where === '' ? 'gspot.toml' : where;
    return `${shown}: ${issue.message}`;
}

// A problem on one of these fields belongs to the entry or key that holds the field, and reading drops that owner.
const FIELD_PROBLEMS = new Set(['reason', 'paths', 'path', 'basePath', 'module', 'group']);

function validatedRaw(text: string, path: string): RawPolicy {
    const result = policySchema.safeParse(parseTomlText(text, path));
    if (!result.success) {
        const locations = sourceLocations(text);
        const problems = result.error.issues.flatMap((issue) => {
            const segments = issue.path.filter((part): part is PathSegment => typeof part !== 'symbol');
            return issue.code === 'unrecognized_keys'
                ? issue.keys.map(
                      (key) =>
                          `${path}:${policyLocation(locations, [...segments, key])}: ${issueText({ ...issue, keys: [key] })}`,
                  )
                : [`${path}:${policyLocation(locations, segments)}: ${issueText(issue)}`];
        });
        throw new PolicyError(problems);
    }
    if (result.data.version !== 1)
        throw new PolicyError([
            `${path}:${policyLocation(sourceLocations(text), ['version'])}: ${messages.versionUnsupported(result.data.version)}`,
        ]);
    return result.data;
}

// A problem whose owner is a configurations list is settled by a root value, never by dropping the list.
function isSettledElsewhere(problem: PolicyProblem): boolean {
    return ownerOf(problem.path).at(-1) === 'configurations';
}

function semanticProblems(policy: Policy, root: string | undefined): PolicyProblem[] {
    return [...reasonProblems(policy), ...(root === undefined ? [] : pathProblems(root, policy))];
}

// What check reads around: every problem an edit command refuses a policy for, other than its shape.
function recoverableProblems(policy: Policy, root: string | undefined): PolicyProblem[] {
    return [...semanticProblems(policy, root), ...completenessProblems(policy)];
}

function completePolicy(text: string, path: string, raw: RawPolicy): Policy {
    const policy = normalize(raw);
    const unknown = unknownConfigurationProblems(policy);
    if (unknown.length > 0) throw new PolicyError(problemLines(text, path, unknown));
    return policy;
}

function problemLines(text: string, path: string, problems: PolicyProblem[]): string[] {
    const locations = sourceLocations(text);
    return problems.map((problem) => `${path}:${policyLocation(locations, problem.path)}: ${problem.message}`);
}

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

function dropOwner(raw: RawPolicy, owner: PathSegment[]): void {
    let container: unknown = raw;
    for (const segment of owner.slice(0, -1)) {
        if (typeof container !== 'object' || container === null) return;
        container = (container as Record<PathSegment, unknown>)[segment];
    }
    const last = owner.at(-1);
    if (Array.isArray(container) && typeof last === 'number') container.splice(last, 1);
    else if (typeof container === 'object' && container !== null && typeof last === 'string')
        Reflect.deleteProperty(container, last);
}

/**
 * Parse TOML and retain the parser location in policy errors.
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
        throw new PolicyError([messages.tomlSyntax(`${path}:${String(error.line)}:${String(error.column)}`, detail)]);
    }
}

/** Every problem a policy file has, as one error with one line per problem. */
export class PolicyError extends Error {
    readonly problems: string[];

    /**
     * Joins the problems into the message and keeps them as a list.
     * @param problems the problems in plain English
     */
    constructor(problems: string[]) {
        super(problems.join('\n'));
        this.name = 'PolicyError';
        this.problems = problems;
    }
}

/**
 * Parses and validates the text of a gspot.toml. Throws PolicyError with every problem found.
 * @param text the file's text
 * @param path the file's name, for messages
 * @param root the repository root, when scopes are to be checked against the file system
 * @returns the normalized policy
 */
export function parsePolicyText(text: string, path: string, root?: string): Policy {
    const policy = normalize(validatedRaw(text, path));
    const problems = semanticProblems(policy, root);
    if (problems.length > 0) throw new PolicyError(problemLines(text, path, problems));
    return policy;
}

/**
 * Reads the text of a gspot.toml the way check does: a wrong entry or key is a finding with its line, and the rest
 * of the config stands without it. A syntax error, an unknown key, or a wrong shape still throws PolicyError.
 * @param text the file's text
 * @param path the file's name, for messages
 * @param root the repository root, when scopes are to be checked against the file system
 * @returns the policy without the wrong entries, and one finding per wrong entry
 */
export function readPolicyText(
    text: string,
    path: string,
    root?: string,
): { policy: Policy; problems: PolicyFinding[] } {
    const raw = validatedRaw(text, path);
    const complete = completePolicy(text, path, raw);
    // One finding per wrong value: a refused reason is also a loosening without one, and the line is the same.
    const found = [
        ...new Map(
            recoverableProblems(complete, root).map((problem) => [JSON.stringify(ownerOf(problem.path)), problem]),
        ).values(),
    ];

    if (found.length === 0) return { policy: complete, problems: [] };
    if (found.some((problem) => isSettledElsewhere(problem))) throw new PolicyError(problemLines(text, path, found));
    const locations = sourceLocations(text);
    const problems = found.map((problem) => ({ ...problem, ...policyPosition(locations, problem.path) }));
    const owners = new Map(found.map((problem) => [JSON.stringify(ownerOf(problem.path)), ownerOf(problem.path)]));
    for (const owner of [...owners.values()].toSorted(byRemovalOrder)) dropOwner(raw, owner);
    const policy = completePolicy(text, path, raw);
    const remaining = recoverableProblems(policy, root);
    if (remaining.length > 0) throw new PolicyError(problemLines(text, path, remaining));
    return { policy, problems };
}

/**
 * Every problem the selection and the surface find in a parsed policy. Throws PolicyError when there are any.
 * @param source the parsed policy and its authored text
 */
export function assertPolicyComplete(source: Pick<PolicyFiles, 'policy' | 'text' | 'path'>): void {
    const unknown = unknownConfigurationProblems(source.policy);
    if (unknown.length > 0) throw new PolicyError(problemLines(source.text, source.path, unknown));
    const problems = completenessProblems(source.policy);
    if (problems.length > 0) throw new PolicyError([...new Set(problemLines(source.text, source.path, problems))]);
}

/**
 * Refuses a policy that check reads with findings: a command that writes from the policy needs every line right.
 * @param files the policy as read
 */
export function assertNoProblems(files: PolicyFiles): void {
    if (files.problems.length === 0) return;
    throw new PolicyError(
        files.problems.map(
            (problem) => `gspot.toml:${String(problem.line)}:${String(problem.column)}: ${problem.message}`,
        ),
    );
}

/**
 * True when a root has a gspot.toml.
 * @param root the repository root
 * @returns whether the file is there
 */
export function hasPolicy(root: string): boolean {
    return openConfinedRoot(root).read('gspot.toml') !== undefined;
}

/**
 * Loads gspot.toml from a repository root.
 * @param root the repository root
 * @returns the policy and the file's path and text
 */
export function readPolicy(root: string): PolicyFiles {
    const path = join(root, 'gspot.toml');
    const current = openConfinedRoot(root).read('gspot.toml');
    if (current === undefined) throw new PolicyError([messages.fileMissing('gspot.toml')]);
    const text = current.bytes.toString('utf8');
    const { policy, problems } = readPolicyText(text, 'gspot.toml', root);
    return { policy, path, text, problems };
}

export type PolicyFiles = {
    policy: Policy;
    path: string;
    text: string;
    /** The wrong entries reading dropped, each with its line; empty for a policy every command accepts. */
    problems: PolicyFinding[];
};

/** A wrong entry or key of gspot.toml, where it is, and what is wrong with it. */
export type PolicyFinding = PolicyProblem & { line: number; column: number };
