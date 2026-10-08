import type { z } from 'zod';
import { join } from 'node:path';
import { GspotError } from '#cli/platform/public.ts';
import { buildPolicy } from '#cli/policy/normalize.ts';
import { readText } from '#cli/platform/root/public.ts';
import { policySchema } from '#cli/policy/schema/public.ts';
import type { KeyPath } from '#cli/types/parsers/document.ts';
import { collectPins } from '#cli/configurations/contracts.ts';
import { everyTable } from '#cli/policy/settings/contracts.ts';
import { knownSettings } from '#cli/policy/settings/public.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { validateAgainstSurface } from '#cli/policy/errors/public.ts';
import { selectForScope } from '#cli/configurations/selection/public.ts';
import { architectureRolesSchema } from '#cli/policy/schema/contracts.ts';
import type { ConfigurationDeclaration } from '#cli/types/configurations.ts';
import { unknownConfigurations } from '#cli/configurations/errors/public.ts';
import { parseTomlText, readPolicyFile } from '#cli/policy/document/public.ts';
import { similar, valueAt, codeList, isRecord } from '#cli/platform/contracts.ts';
import { configurationFiles, configurationManifests } from '#cli/configurations/public.ts';
import { FIRST_READ, FIELD_PROBLEMS, SCOPE_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import type { Policy, RawPolicy, PolicyFile, PolicyError, RuleExclusionError } from '#cli/types/policy/settings.ts';

import {
    reasonErrors,
    toolOptionErrors,
    restrictionErrors,
    pathErrors as getPathErrors,
} from '#cli/policy/errors/contracts.ts';

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
 * The configuration names a policy selects that no manifest defines, each at its declaration.
 * @param policy the parsed policy
 * @returns one error per unknown name
 */
export function unknownConfigurationErrors(policy: Policy): PolicyError[] {
    const manifests = configurationManifests();
    const declarations: ConfigurationDeclaration[] = [
        ...policy.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
        ...Object.entries(policy.scope).flatMap(([path, scope]) =>
            scope.configurations.map((name, index) => ({ name, path: ['scope', path, 'configurations', index] })),
        ),
    ];
    return unknownConfigurations(declarations, manifests).map(({ path, message: diagnostic }) => ({
        path,
        message: diagnostic,
    }));
}

/**
 * Every error the selection and the surface find in a policy whose configuration names all exist.
 * @param policy the parsed policy
 * @returns the errors, each at the value that raised it
 */
export function completenessErrors(policy: Policy): PolicyError[] {
    const manifests = configurationManifests();
    const errors: PolicyError[] = [];
    const tools = collectPins([...manifests.values()]);
    for (const { table, path } of everyTable(policy))
        errors.push(...toolOptionErrors(table, tools).map((error) => ({ ...error, path: [...path, ...error.path] })));
    const rootSelected = selectForScope(policy, '', manifests);
    // A scope table is read against the settings of the configurations that scope selects, the root configurations included.
    const scopeSurfaces = new Map(
        Object.keys(policy.scope).map((scope) => [
            scope,
            knownSettings(selectForScope(policy, scope, manifests), policy.level),
        ]),
    );
    errors.push(
        ...everyTable(policy).flatMap(({ table, scope, path }) => {
            const selected =
                scope === undefined
                    ? [
                          rootSelected,
                          ...Object.keys(policy.scope).map((name) => selectForScope(policy, name, manifests)),
                      ].flat()
                    : selectForScope(policy, scope, manifests);
            const declarations = new Set(
                selected.flatMap((manifest) => manifest.settings.map((setting) => setting.name)),
            );
            return (table.architecture === undefined ? [] : Object.keys(table.architecture.roles))
                .filter(
                    (role) =>
                        !Object.hasOwn(architectureRolesSchema.shape, role) &&
                        !declarations.has(`architecture.roles.${role}`),
                )
                .map((role) => ({
                    path: [...path, 'architecture', 'roles', role],
                    message: `The ${role} architecture role is not declared by a selected configuration.`,
                }));
        }),
        ...excludeErrors(policy.agent_rules.exclude).map(({ index, message: diagnostic }) => ({
            path: ['agent_rules', 'exclude', index],
            message: diagnostic,
        })),
        ...validateAgainstSurface(
            knownSettings(rootSelected, policy.level),
            policy,
            scopeSurfaces,
            knownSettings([...manifests.values()], policy.level),
        ),
    );
    return errors;
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

/**
 * Whether an exclusion names a rule file or an ancestor folder.
 * @param entry the authored exclusion.
 * @param path the rule path relative to its folder.
 * @returns whether the entry excludes the rule.
 */
export function isExcluded(entry: string, path: string): boolean {
    return path === entry || path.startsWith(`${entry.replace(/\/$/u, '')}/`);
}

/**
 * The errors in [agent_rules] exclude: an entry that matches no rule, and an entry that hides a file the reader opens first.
 * @param exclude the entries as written, relative to the rules folder
 * @returns each error with its position in the exclusion list
 */
export function excludeErrors(exclude: string[]): RuleExclusionError[] {
    if (exclude.length === 0) return [];
    const paths = [...configurationManifests().values()].flatMap((manifest) =>
        configurationFiles(manifest).map((file) => file.path),
    );
    return exclude.flatMap((entry, index) => {
        if (FIRST_READ.some((file) => isExcluded(entry, file)))
            return [
                {
                    index,
                    message: `[agent_rules] exclude names ${codeList([entry])}, which holds a file every agent opens first (${codeList(FIRST_READ)}). Remove the entry.`,
                },
            ];
        if (paths.some((path) => isExcluded(entry, path))) return [];
        const near = similar(entry, paths);
        const hint = near.length > 0 ? ` Did you mean ${codeList(near)}?` : '';
        return [{ index, message: `[agent_rules] exclude names ${codeList([entry])}, which matches no rule.${hint}` }];
    });
}
