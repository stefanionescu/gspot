import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { readSource } from '#cli/platform/source.ts';
import { isOwned } from '#cli/configurations/owners.ts';
import { CASE_NAMES } from '#cli/parsers/naming/names.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { sqlIdentifiers } from '#cli/parsers/naming/sql.ts';
import { bashIdentifiers } from '#cli/parsers/naming/bash.ts';
import type { Identifier } from '#cli/types/parsers/naming.ts';
import { selectForScope } from '#cli/configurations/select.ts';
import { POLICY_FILE } from '#cli/config/platform/locations.ts';
import { swiftIdentifiers } from '#cli/parsers/naming/swift.ts';
import { REACT_FILE } from '#cli/config/checks/general/naming.ts';
import { pythonIdentifiers } from '#cli/parsers/naming/python.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { nameProblems } from '#cli/checks/general/naming/problems.ts';
import { effectivePolicy } from '#cli/checks/general/naming/policy.ts';
import type { Engine, EngineInput } from '#cli/types/execution/check.ts';
import { typescriptIdentifiers } from '#cli/parsers/naming/typescript.ts';
import { everyTable, repositoryHarnessFolders } from '#cli/policy/settings/lookup.ts';
import { fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/paths.ts';
import type { FileNames, NamingSource, EffectivePolicy } from '#cli/types/checks/general/naming.ts';

function sourceFiles(input: EngineInput): NamingSource[] {
    const languages = input.selection.selected.filter((manifest) => manifest.configuration.kind === 'language');
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find((manifest) => isOwned(manifest.files, file))?.configuration.name,
        }))
        .filter((entry): entry is NamingSource => entry.language !== undefined);
}

function findingsFor(input: EngineInput, policy: EffectivePolicy, identifiers: Identifier[]): Finding[] {
    const isTestFile = pathMatcher(input.view.settings['tests'] as string[]);
    return identifiers.flatMap((identifier) =>
        nameProblems(identifier, {
            policy,
            isReactFile: REACT_FILE.test(identifier.file),
            isTestFile: isTestFile(posix.relative(input.scope, identifier.file)),
        }).map((problem) => {
            const source = problem.source === undefined ? '' : ` (${problem.source})`;
            return findingAt(
                input,
                { file: identifier.file, line: identifier.line, column: identifier.column },
                problem.rule,
                `${identifier.kind} "${identifier.name}": ${problem.message}${source}.`,
            );
        }),
    );
}

async function identifierFindings(input: EngineInput, policy: EffectivePolicy): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const { file, language } of sourceFiles(input)) {
        const text = readSource(input.root, file.path, input.reads).toString('utf8');
        const identifiers = await identifiersOf(file.path, text, language, input);
        findings.push(...findingsFor(input, policy, identifiers));
    }
    return findings;
}

function pathIdentifiers(input: EngineInput): Identifier[] {
    const harnesses = new Set(repositoryHarnessFolders(input.policyFiles.policy, input.scope));
    const seen = new Set<string>();
    return sourceFiles(input).flatMap(({ file, language }) => {
        const all = [fileIdentifier(file.path, language), ...directoryIdentifiers(file.path, language)];
        return all.filter((identifier) => {
            if (identifier.directory !== undefined && harnesses.has(identifier.directory)) return false;
            const key = JSON.stringify([identifier.directory ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

async function declaredNames(input: EngineInput): Promise<FileNames[]> {
    const policy = input.policyFiles.policy;
    const selections = new Map(
        input.scopeEntries.map((scope) => [
            scope.path,
            selectForScope(policy, scope.path, input.manifests).filter(
                (manifest) => manifest.configuration.kind === 'language',
            ),
        ]),
    );
    const files: FileNames[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        const scope = scopeOf(file.path, input.scopeEntries);
        const language = selections.get(scope.path)?.find((manifest) => isOwned(manifest.files, file));
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
            names: [fileIdentifier(file.path, name), ...directoryIdentifiers(file.path, name), ...identifiers].map(
                (identifier) => identifier.name,
            ),
        });
    }
    return files;
}

// Reports root and scope entries in gspot.toml that match no file or name.
async function policyFindings(input: EngineInput): Promise<Finding[]> {
    const policy = input.policyFiles.policy;
    const files = await declaredNames(input);
    const layers = everyTable(policy).flatMap(({ table, scope = '' }) =>
        table.naming === undefined ? [] : [{ scope, naming: table.naming }],
    );
    return layers.flatMap(({ scope, naming }) => {
        const scopeFiles = files.filter((file) => isInScope(file.path, scope));
        const names = new Set(scopeFiles.flatMap((file) => file.names));
        const unused = naming.allowed
            .filter((entry) => !names.has(entry.name))
            .map((entry) => `naming.allowed names "${entry.name}", which no identifier in this scope carries.`);
        const dead = naming.paths
            .filter((rule) => {
                const matches = pathMatcher(rule.paths);
                return scopeFiles.every((file) => !matches(file.path));
            })
            .map((rule) => `A [[naming.paths]] entry matches no file: ${rule.paths.join(', ')}.`);
        const cases = naming.paths
            .flatMap((rule) => rule.case ?? [])
            .filter((name) => !CASE_NAMES.includes(name))
            .map(
                (name) =>
                    `A [[naming.paths]] entry names the case "${name}", which is not one of ${CASE_NAMES.join(', ')}.`,
            );
        return [...unused, ...dead, ...cases].map((text) =>
            findingAt(input, { file: POLICY_FILE }, 'stale-entry', scope === '' ? text : `${text} (scope ${scope})`),
        );
    });
}

// The engine of one naming analysis: the effective naming policy of the scope, then the analysis.
function namingEngine(
    analysis: (input: EngineInput, policy: EffectivePolicy) => Finding[] | Promise<Finding[]>,
): Engine {
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

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path
 * @param text the file text
 * @param language the language configuration the file belongs to
 * @param context optional execution reads and their resource owner
 * @returns the identifiers in document order
 */
export async function identifiersOf(
    file: string,
    text: string,
    language: string,
    context?: Pick<EngineInput, 'reads' | 'resources'>,
): Promise<Identifier[]> {
    if (language === 'sql') return sqlIdentifiers(file, text, context?.reads);
    const grammar = grammarFor(file, language);
    if (grammar === undefined) return [];
    const tree = await parseSource(grammar, text, context);
    try {
        let identifiers: Identifier[];
        switch (grammar) {
            case 'bash': {
                identifiers = bashIdentifiers(tree.rootNode, file);
                break;
            }
            case 'swift': {
                identifiers = swiftIdentifiers(tree.rootNode, file);
                break;
            }
            case 'python': {
                identifiers = pythonIdentifiers(tree.rootNode, file);
                break;
            }
            default: {
                identifiers = typescriptIdentifiers(tree.rootNode, file, language);
            }
        }
        return identifiers.toSorted((left, right) => left.line - right.line || left.column - right.column);
    } finally {
        tree.delete();
    }
}

export const namingIdentifiers: Engine = namingEngine(identifierFindings);

export const namingPaths: Engine = namingEngine((input, policy) => findingsFor(input, policy, pathIdentifiers(input)));

export const namingPolicy: Engine = namingEngine(policyFindings);
