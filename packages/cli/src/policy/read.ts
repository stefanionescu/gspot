// Read, parse and validate gspot.toml and gspot.local.toml; normalize into the Policy shape.
import type { z } from 'zod';
import { join } from 'node:path';
import { parse as parseToml } from 'smol-toml';
import { existsSync, readFileSync } from 'node:fs';
import * as messages from '#cli/policy/messages.ts';
import { normalize } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/policy/schema.ts';
import { localSchema } from '#cli/policy/local-schema.ts';
import { reasonProblems, scopeProblems } from '#cli/policy/problems.ts';
import type { PolicyFiles, LocalPolicy, PathSegment, Policy, SchemaNode } from '#types/config.ts';

function nodeOf(value: unknown): SchemaNode {
    return value ?? {};
}

function unwrapped(node: SchemaNode): SchemaNode {
    let current = node;
    while (current.def && (current.def['type'] === 'optional' || current.def['type'] === 'nullable'))
        current = nodeOf(current.def['innerType']);
    return current;
}

function shapeOf(node: SchemaNode): Record<string, unknown> | undefined {
    return (node.shape ?? node.def?.['shape']) as Record<string, unknown> | undefined;
}

function childAt(node: SchemaNode, segment: PathSegment): SchemaNode | undefined {
    const def = unwrapped(node).def;
    if (!def) return undefined;
    switch (def['type']) {
        case 'object': {
            const next = shapeOf(unwrapped(node))?.[String(segment)] ?? def['catchall'];
            return next === undefined ? undefined : nodeOf(next);
        }
        case 'array': {
            return nodeOf(def['element']);
        }
        case 'record': {
            return nodeOf(def['valueType']);
        }
        default: {
            return undefined;
        }
    }
}

function shapeAt(schema: unknown, path: PathSegment[]): string[] {
    let current: SchemaNode | undefined = nodeOf(schema);
    for (const segment of path) {
        const def = unwrapped(current).def;
        if (def?.['type'] === 'union') {
            const options = def['options'] as unknown[];
            return options.map((option) => shapeAt(option, path)).find((keys) => keys.length > 0) ?? [];
        }
        current = childAt(current, segment);
        if (!current) return [];
    }
    const shape = shapeOf(unwrapped(current));
    return shape ? Object.keys(shape) : [];
}

function issueText(issue: z.core.$ZodIssue): string {
    const where = issue.path.map(String).join('.');
    if (issue.code === 'unrecognized_keys') {
        const path = issue.path.filter((segment): segment is PathSegment => typeof segment !== 'symbol');
        const known = shapeAt(policySchema, path);
        return issue.keys.map((key) => messages.unknownKey(where, key, known)).join('\n');
    }
    const shown = where === '' ? 'gspot.toml' : where;
    if (issue.code === 'invalid_type')
        return messages.invalidValue(shown, `expected ${issue.expected}, got ${typeof issue.input}`);
    return messages.invalidValue(shown, issue.message);
}

function parseTomlText(text: string, path: string): unknown {
    try {
        return parseToml(text);
    } catch (error) {
        throw new PolicyError([messages.tomlSyntax(path, (error as Error).message)]);
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
    if (!result.success) throw new PolicyError(result.error.issues.map((issue) => issueText(issue)));
    if (result.data.version !== 1) throw new PolicyError([messages.versionUnsupported(result.data.version)]);
    const policy = normalize(result.data);
    const problems = [...reasonProblems(policy), ...(root === undefined ? [] : scopeProblems(root, policy))];
    if (problems.length > 0) throw new PolicyError(problems);
    return policy;
}

/**
 * Parses gspot.local.toml. Any key but skip is refused.
 * @param text the file's text
 * @returns the local policy
 */
export function parseLocalText(text: string): LocalPolicy {
    const result = localSchema.safeParse(parseTomlText(text, 'gspot.local.toml'));
    if (!result.success)
        throw new PolicyError(
            result.error.issues.map((issue) =>
                issue.code === 'unrecognized_keys'
                    ? issue.keys.map((key) => messages.localOnlySkip(key)).join('\n')
                    : issueText(issue),
            ),
        );
    return { skip: result.data.skip ?? [] };
}

/**
 * The path of gspot.toml under a root.
 * @param root the repository root
 * @returns the absolute path
 */
export function policyPath(root: string): string {
    return join(root, 'gspot.toml');
}

/**
 * True when a root has a gspot.toml.
 * @param root the repository root
 * @returns whether the file is there
 */
export function hasPolicy(root: string): boolean {
    return existsSync(policyPath(root));
}

/**
 * Loads gspot.toml and gspot.local.toml from a repository root.
 * @param root the repository root
 * @returns the policy, the local policy, and the file's path and text
 */
export function readPolicy(root: string): PolicyFiles {
    const path = policyPath(root);
    if (!existsSync(path)) throw new PolicyError([messages.fileMissing('gspot.toml')]);
    const text = readFileSync(path, 'utf8');
    const policy = parsePolicyText(text, 'gspot.toml', root);
    const localPath = join(root, 'gspot.local.toml');
    const local = existsSync(localPath) ? parseLocalText(readFileSync(localPath, 'utf8')) : { skip: [] };
    return { policy, local, path, text };
}
