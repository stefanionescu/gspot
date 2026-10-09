import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { isInScope, pathMatcher } from '#cli/repository/paths/public.ts';
import { isOwned, selectForScope } from '#cli/repository/selection/public.ts';
import type { CheckInput, BuiltInCheck } from '#cli/types/execution/check.ts';
import { everyTable, harnessFolders } from '#cli/policy/settings/contracts.ts';
import { CASE_NAMES, nameFindings } from '#cli/checks/general/naming/public.ts';
import type { FileNames, NamingSource, EffectivePolicy } from '#cli/types/checks/general/naming.ts';

import {
    identifiersOf,
    fileIdentifier,
    effectivePolicy,
    directoryIdentifiers,
} from '#cli/checks/general/naming/contracts.ts';

function sourceFiles(input: CheckInput): NamingSource[] {
    const languages = input.selection.selected.filter((manifest) => manifest.configuration.kind === 'language');
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find((manifest) => isOwned(manifest.files, file))?.configuration.name,
        }))
        .filter((entry): entry is NamingSource => entry.language !== undefined);
}

function findingsFor(input: CheckInput, policy: EffectivePolicy, identifiers: Identifier[]): Finding[] {
    const isTestFile = pathMatcher(input.view.settings['test_files'] as string[]);
    return identifiers.flatMap((identifier) =>
        nameFindings(identifier, {
            check: input.check,
            policy,
            isTestFile: isTestFile(identifier.file),
        }),
    );
}

async function identifierFindings(input: CheckInput, policy: EffectivePolicy): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const { file, language } of sourceFiles(input)) {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const identifiers = await identifiersOf(file.path, text, language, input);
        findings.push(...findingsFor(input, policy, identifiers));
    }
    return findings;
}

function pathIdentifiers(input: CheckInput): Identifier[] {
    const harnesses = new Set(harnessFolders(input.policyFiles.policy, input.scope));
    const containers = input.selection.selected.flatMap((manifest) => manifest.naming?.path_containers ?? []);
    const seen = new Set<string>();
    return sourceFiles(input).flatMap(({ file, language }) => {
        const all = [
            fileIdentifier(file.path, language, containers),
            ...directoryIdentifiers(file.path, language, containers),
        ];
        return all.filter((identifier) => {
            if (identifier.directory !== undefined && harnesses.has(identifier.directory)) return false;
            const key = JSON.stringify([identifier.directory ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

async function declaredNames(input: CheckInput): Promise<FileNames[]> {
    const policy = input.policyFiles.policy;
    const selections = new Map(
        input.scopeEntries.map((scope) => [scope.path, selectForScope(policy, scope.path, input.manifests)]),
    );
    const files: FileNames[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        const scope = scopeOf(file.path, input.scopeEntries);
        const selected = selections.get(scope.path) ?? [];
        const language = selected.find(
            (manifest) => manifest.configuration.kind === 'language' && isOwned(manifest.files, file),
        );
        const containers = selected.flatMap((manifest) => manifest.naming?.path_containers ?? []);
        if (language === undefined) continue;
        const name = language.configuration.name;
        const identifiers = await identifiersOf(
            file.path,
            readSource(input.root, file.path, input.reads).toString('utf8'),
            name,
            input,
        );
        files.push({
            path: file.path,
            names: [
                fileIdentifier(file.path, name, containers),
                ...directoryIdentifiers(file.path, name, containers),
                ...identifiers,
            ].map((identifier) => identifier.name),
        });
    }
    return files;
}

// Reports root and scope entries in gspot.toml that match no file or name.
async function policyFindings(input: CheckInput): Promise<Finding[]> {
    const policy = input.policyFiles.policy;
    const files = await declaredNames(input);
    const layers = everyTable(policy).flatMap(({ table, scope = '' }) =>
        table.naming === undefined ? [] : [{ scope, naming: table.naming }],
    );
    return layers.flatMap(({ scope, naming }) => {
        const scopeFiles = files.filter((file) => isInScope(file.path, scope));
        const names = new Set(scopeFiles.flatMap((file) => file.names));
        const unused = Object.keys(naming.allowed)
            .filter((name) => !names.has(name))
            .map((name) => `naming.allowed names "${name}", which no identifier in this scope carries.`);
        const dead = naming.overrides
            .filter((rule) => {
                const matches = pathMatcher(rule.paths);
                return scopeFiles.every((file) => !matches(file.path));
            })
            .map((rule) => `A [[naming.overrides]] entry matches no file: ${rule.paths.join(', ')}.`);
        const cases = naming.overrides
            .flatMap((rule) => rule.case ?? [])
            .filter((name) => !CASE_NAMES.includes(name))
            .map(
                (name) =>
                    `A [[naming.overrides]] entry names the case "${name}", which is not one of ${CASE_NAMES.join(', ')}.`,
            );
        return [...unused, ...dead, ...cases].map((text) =>
            findingAt(input, { file: POLICY_FILE }, 'stale-entry', scope === '' ? text : `${text} (scope ${scope})`),
        );
    });
}

// One naming analysis: the effective naming policy of the scope, then the analysis.
function namingCheck(
    analysis: (input: CheckInput, policy: EffectivePolicy) => Finding[] | Promise<Finding[]>,
): BuiltInCheck {
    return (input) => {
        const policy = effectivePolicy(
            input.selection.surface,
            input.policyFiles.policy,
            input.scope,
            input.selection.selected,
        );
        return analysis(input, policy);
    };
}

export const namingIdentifiers: BuiltInCheck = namingCheck(identifierFindings);

export const namingPaths: BuiltInCheck = namingCheck((input, policy) =>
    findingsFor(input, policy, pathIdentifiers(input)),
);

export const namingPolicy: BuiltInCheck = namingCheck(policyFindings);
