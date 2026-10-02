import { isOwned } from '#cli/kits/owners.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import { findingAt } from '#cli/execution/finding.ts';
import { readSource } from '#cli/repository/sources.ts';
import { harnessFolders } from '#cli/policy/settings.ts';
import { CASE_NAMES } from '#cli/checks/general/naming/cases.ts';
import { languageKits, selectForScope } from '#cli/kits/select.ts';
import { TEST_FILE, REACT_FILE } from '#cli/config/checks/naming.ts';
import { grammarFor, parseSource } from '#cli/parsers/tree-sitter.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { nameProblems } from '#cli/checks/general/naming/problems.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { sqlIdentifiers } from '#cli/checks/general/naming/extractors/sql.ts';
import { bashIdentifiers } from '#cli/checks/general/naming/extractors/bash.ts';
import { swiftIdentifiers } from '#cli/checks/general/naming/extractors/swift.ts';
import { pythonIdentifiers } from '#cli/checks/general/naming/extractors/python.ts';
import { shippedPolicy, effectivePolicy } from '#cli/checks/general/naming/policy.ts';
import { fileIdentifier, directoryIdentifiers } from '#cli/checks/general/naming/paths.ts';
import { typescriptIdentifiers } from '#cli/checks/general/naming/extractors/typescript.ts';
import type { Engine, Finding, Identifier, EngineInput, NamingInputs, EffectivePolicy } from '#cli/types/checks.ts';

function sourceFiles(input: EngineInput): { file: TrackedFile; language: string }[] {
    const languages = languageKits(input.selection.selected);
    return input.files
        .filter((file) => file.kind === 'source')
        .map((file) => ({
            file,
            language: languages.find((manifest) => isOwned(manifest.owners, file))?.kit.name,
        }))
        .filter((entry): entry is { file: TrackedFile; language: string } => entry.language !== undefined);
}

function findingsFor(input: EngineInput, policy: EffectivePolicy, identifiers: Identifier[], path: string): Finding[] {
    const context: NamingInputs = { policy, isReactFile: REACT_FILE.test(path), isTestFile: TEST_FILE.test(path) };
    return identifiers.flatMap((identifier) =>
        nameProblems(identifier, context).map((problem) => {
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
        findings.push(...findingsFor(input, policy, identifiers, file.path));
    }
    return findings;
}

function pathIdentifiers(input: EngineInput): Identifier[] {
    const harnesses = new Set(
        harnessFolders(input.policyFiles.policy, input.scope).map((folder) =>
            [input.scope, folder].filter(Boolean).join('/'),
        ),
    );
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

async function scopeIdentifiers(input: EngineInput): Promise<{ path: string; names: string[] }[]> {
    const policy = input.policyFiles.policy;
    const selections = new Map(
        input.scopeEntries.map((scope) => [
            scope.path,
            languageKits(selectForScope(policy, scope.path, input.manifests)),
        ]),
    );
    const read: { path: string; names: string[] }[] = [];
    for (const file of input.files) {
        if (file.kind !== 'source') continue;
        const scope = scopeOf(file.path, input.scopeEntries);
        const language = selections.get(scope.path)?.find((manifest) => isOwned(manifest.owners, file));
        if (language === undefined) continue;
        const name = language.kit.name;
        const identifiers = await identifiersOf(
            file.path,
            readSource(input.root, file.path, input.reads).toString('utf8'),
            name,
            input,
        );
        read.push({
            path: file.path,
            names: [fileIdentifier(file.path, name), ...directoryIdentifiers(file.path, name), ...identifiers].map(
                (identifier) => identifier.name,
            ),
        });
    }
    return read;
}

// Validate each authored layer once against the complete snapshot, including nested scopes.
async function schemaFindings(input: EngineInput): Promise<Finding[]> {
    const policy = input.policyFiles.policy;
    const read = await scopeIdentifiers(input);
    const removable = new Set(
        Object.entries(shippedPolicy().groups)
            .filter(([, group]) => group.removable)
            .map(([name]) => name),
    );
    const layers = [
        { scope: '', naming: policy.naming },
        ...Object.entries(policy.scopeTables).flatMap(([scope, table]) =>
            table.naming === undefined ? [] : [{ scope, naming: table.naming }],
        ),
    ];
    return layers.flatMap(({ scope, naming }) => {
        const files = read.filter((file) => isInScope(file.path, scope));
        const names = new Set(files.flatMap((file) => file.names));
        const unused = naming.allowed
            .filter((entry) => !names.has(entry.name))
            .map((entry) => `naming.allowed names "${entry.name}", which no identifier in this scope carries.`);
        const dead = naming.rules
            .filter((rule) => files.every((file) => !pathMatcher(rule.paths)(file.path)))
            .map((rule) => `A [[naming.rules]] entry matches no file: ${rule.paths.join(', ')}.`);
        const cases = naming.rules
            .flatMap((rule) => rule.case ?? [])
            .filter((name) => !CASE_NAMES.includes(name))
            .map(
                (name) =>
                    `A [[naming.rules]] entry names the case "${name}", which is not one of camel, pascal, pascal-plus, kebab, snake, upper-snake or snake-migration.`,
            );
        const groups = naming.remove_groups
            .filter((entry) => !removable.has(entry.group))
            .map((entry) => `naming.remove_groups names "${entry.group}", which is not a removable group.`);
        return [...unused, ...dead, ...groups, ...cases].map((text) =>
            findingAt(input, { file: 'gspot.toml' }, 'configuration', scope === '' ? text : `${text} (scope ${scope})`),
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

/** The naming checks, by check ID. */
export const NAMING_ENGINES: Record<string, Engine> = {
    'naming/identifiers': namingEngine(identifierFindings),
    'naming/paths': namingEngine((input, policy) =>
        pathIdentifiers(input).flatMap((identifier) => findingsFor(input, policy, [identifier], identifier.file)),
    ),
    'naming/policy-schema': namingEngine(schemaFindings),
};

/**
 * The identifiers a file declares, or none when no extractor reads its language.
 * @param file the file path
 * @param text the file text
 * @param language the language kit the file belongs to
 * @param context optional execution reads and their resource owner
 * @returns the identifiers
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
    if (tree === null) throw new Error('The source parser returned no tree.');
    try {
        if (grammar === 'bash') return bashIdentifiers(tree.rootNode, file);
        if (grammar === 'swift') return swiftIdentifiers(tree.rootNode, file);
        if (grammar === 'python') return pythonIdentifiers(tree.rootNode, file);
        return typescriptIdentifiers(tree.rootNode, file, language);
    } finally {
        tree.delete();
    }
}
