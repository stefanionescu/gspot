// Read, parse and validate gspot.toml; normalize into the Policy shape.
import type { z } from 'zod';
import { join } from 'node:path';
import * as messages from '#cli/policy/messages.ts';
import { normalize } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/schemas/policy.ts';
import { knownKeysAt } from '#cli/policy/json-schema.ts';
import { parse as parseToml, TomlError } from 'smol-toml';
import { openConfinedRoot } from '#cli/filesystem/confined.ts';
import { reasonProblems, pathProblems } from '#cli/policy/problems.ts';
import type { PolicyFiles, PathSegment, Policy } from '#cli/types/policy.ts';
import { policyLocation, sourceLocations } from '#cli/policy/source-locations.ts';

function issueText(issue: z.core.$ZodIssue): string {
    const where = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
        const path = issue.path.filter((segment): segment is PathSegment => typeof segment !== 'symbol');
        const known = knownKeysAt(path);
        return issue.keys.map((key) => messages.unknownKey(where, key, known)).join('\n');
    }
    const shown = where === '' ? 'gspot.toml' : where;
    return messages.invalidValue(shown, issue.message);
}

/**
 *
 * @param text
 * @param path
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
    const policy = normalize(result.data);
    const problems = [...reasonProblems(policy), ...(root === undefined ? [] : pathProblems(root, policy))];
    if (problems.length > 0) {
        const locations = sourceLocations(text);
        throw new PolicyError(
            problems.map((problem) => `${path}:${policyLocation(locations, problem.path)}: ${problem.message}`),
        );
    }
    return policy;
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
    const policy = parsePolicyText(text, 'gspot.toml', root);
    return { policy, path, text };
}
