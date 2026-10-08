import type { z } from 'zod';
import { join } from 'node:path';
import { readText } from '#cli/platform/source.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { buildPolicy } from '#cli/policy/normalize.ts';
import { policySchema } from '#cli/policy/schema/policy.ts';
import { valueAt, isRecord } from '#cli/platform/objects.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { parseTomlText, readPolicyFile } from '#cli/policy/file.ts';
import { FIELD_PROBLEMS, SCOPE_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import type { Policy, RawPolicy, PolicyFile, PolicyError } from '#cli/types/policy/settings.ts';
import { completenessErrors, unknownConfigurationErrors } from '#cli/policy/errors/selection.ts';
import { reasonErrors, restrictionErrors, pathErrors as getPathErrors } from '#cli/policy/errors/reasons.ts';

function issueLines(path: string, issue: z.core.$ZodIssue): string[] {
    if (issue.code === 'invalid_key')
        return issue.issues.flatMap((child) => issueLines(path, { ...child, path: [...issue.path, ...child.path] }));
    const segments = issue.path.filter((part): part is KeyPath[number] => typeof part !== 'symbol');
    if (issue.code !== 'unrecognized_keys') return [errorText({ path: segments, message: issue.message }, path)];
    const where = segments.map(String).join('.');
    return issue.keys.map(
        (key) =>
            `${path}: \`${key}\` is not a setting gspot knows under ${where === '' ? 'the top level' : '[' + where + ']'}. The gspot.toml schema reference (generativespotting.com/reference/configuration/) lists every key.`,
    );
}

function throwErrors(errors: PolicyError[]): never {
    throw new GspotError(
        'policy',
        errors.map((error) => errorText(error, POLICY_FILE)),
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
    const unknown = unknownConfigurationErrors(policy);
    if (unknown.length > 0) throwErrors(unknown);
    return policy;
}

// Strict commands and check execution validate the same effective policy, including after bad entries are removed.
function collectErrors(policy: Policy, root: string | undefined): PolicyError[] {
    return [
        ...reasonErrors(policy),
        ...restrictionErrors(policy),
        ...(root === undefined ? [] : getPathErrors(root, policy)),
        ...completenessErrors(policy),
    ];
}

function ownerOf(path: KeyPath): KeyPath {
    const depth = path[0] === 'scope' ? SCOPE_KEY_DEPTH : 0;
    const reasonKey = path[depth + 1];
    if (path[depth] === 'words') return path;
    if (path[depth] === 'reasons' && typeof reasonKey === 'string')
        return [...path.slice(0, depth), ...reasonKey.split('.')];
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
    if (Array.isArray(container) && typeof last === 'number') {
        container.splice(last, 1);
        return;
    }
    if (!isRecord(container) || typeof last !== 'string') return;
    Reflect.deleteProperty(container, last);
    const path = owner[0] === 'scope' ? owner.slice(0, SCOPE_KEY_DEPTH) : [];
    const reasons = valueAt(raw, [...path, 'reasons']);
    if (isRecord(reasons)) Reflect.deleteProperty(reasons, owner.slice(path.length).join('.'));
}

/**
 * A policy error as text that leads with its file, when given, and the key path it names.
 * @param error the error
 * @param file the policy file, for a line that names it
 * @returns the text
 */
export function errorText(error: PolicyError, file?: string): string {
    const where = error.path.map(String).join('.');
    const place = [file, where].filter((part) => part !== undefined && part !== '');
    return [...place, error.message].join(': ');
}

/**
 * Parses and validates gspot.toml. Throws GspotError('policy') with every error found.
 *
 * @param text the file's text
 * @param root the repository root, when scopes are to be checked against the file system
 * @returns the normalized policy
 */
export function parseStrictPolicy(text: string, root?: string): Policy {
    const policy = normalizeKnownConfigurations(validatedRaw(text));
    const errors = collectErrors(policy, root);
    if (errors.length > 0) throwErrors(errors);
    return policy;
}

/**
 * Reads policy for check execution. Invalid values become findings and are excluded from the effective policy.
 * Syntax errors, unknown keys, and invalid document shapes throw GspotError('policy').
 *
 * @param text the file's text.
 * @param root the repository root, when scopes are to be checked against the file system.
 * @returns the policy without invalid entries, and each located error.
 */
export function readPolicyText(text: string, root?: string): Pick<PolicyFile, 'policy' | 'errors'> {
    const raw = validatedRaw(text);
    const complete = normalizeKnownConfigurations(raw);
    const found = collectErrors(complete, root);

    if (found.length === 0) return { policy: complete, errors: [] };
    // A configurations list is settled by a root value, never by dropping the list.
    if (found.some((error) => ownerOf(error.path).at(-1) === 'configurations')) throwErrors(found);
    const owners = new Map(found.map((error) => [JSON.stringify(ownerOf(error.path)), ownerOf(error.path)]));
    for (const owner of [...owners.values()].toSorted(byRemovalOrder)) dropOwner(raw, owner);
    const policy = normalizeKnownConfigurations(raw);
    const remaining = collectErrors(policy, root);
    if (remaining.length > 0) throwErrors(remaining);
    return { policy, errors: found };
}

/**
 * Refuses a policy that check reads with findings: a command that writes from the policy needs every line right.
 * @param files the policy as read
 */
export function assertNoErrors(files: PolicyFile): void {
    if (files.errors.length === 0) return;
    throwErrors(files.errors);
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
    const text = readPolicyFile(root);
    const { policy, errors } = readPolicyText(text, root);
    return { policy, path, text, errors };
}
