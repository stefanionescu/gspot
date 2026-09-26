import { isKnownCase } from '#cli/checks/naming/cases.ts';
import { scopeOf } from '#cli/repository/scopes.ts';
import type { Finding } from '#cli/checks/result.ts';
import { identifiersOf } from '#cli/checks/naming/extract.ts';
import { readSource } from '#cli/repository/tracked.ts';
import type { Identifier } from '#cli/checks/naming/extract.ts';
import { nameProblems } from '#cli/checks/naming/validate-name.ts';
import type { EffectivePolicy } from '#cli/checks/naming/policy.ts';
import type { CheckSpec } from '#cli/configurations/schema.ts';
import type { Engine, EngineInput } from '#cli/checks/input.ts';
import type { NamingContext } from '#cli/checks/naming/validate-name.ts';
import { effectivePolicy, shippedPolicy } from '#cli/checks/naming/policy.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { directoryIdentifiers, fileIdentifier } from '#cli/checks/naming/paths.ts';
import { isClaimed } from '#cli/configurations/claims.ts';
import { isInScope, pathMatcher } from '#cli/repository/paths.ts';
import { languageConfigurations, selectForScope } from '#cli/configurations/select.ts';

const REACT_FILE = /\.[jt]sx$/u;
const TEST_FILE = /(?:(?:^|\/)(?:tests?|__tests__)\/)|(?:\.(?:test|spec)\.[^./]+$)/u;

function sourceFiles(input: EngineInput): { file: TrackedFile; language: string }[] {
    const languages = languageConfigurations(input.selection.selected);
    return input.files
        .filter((file) => file.nature === 'source')
        .map((file) => ({
            file,
            language: languages.find((manifest) => isClaimed(manifest.claims, file))?.configuration.name,
        }))
        .filter((entry): entry is { file: TrackedFile; language: string } => entry.language !== undefined);
}

function findingsFor(input: EngineInput, policy: EffectivePolicy, identifiers: Identifier[], path: string): Finding[] {
    const context: NamingContext = { policy, isReactFile: REACT_FILE.test(path), isTestFile: TEST_FILE.test(path) };
    return identifiers.flatMap((identifier) =>
        nameProblems(identifier, context).map((problem) => ({
            check: input.spec.name,
            file: identifier.file,
            line: identifier.line,
            column: identifier.column,
            rule: problem.rule,
            message: `${identifier.kind} "${identifier.name}": ${problem.message}${problem.source === undefined ? '' : ` (${problem.source})`}.`,
            fixable: false,
        })),
    );
}

async function identifierFindings(input: EngineInput, policy: EffectivePolicy): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const { file, language } of sourceFiles(input)) {
        const text = readSource(input.root, file.path, input.observations).toString('utf8');
        const identifiers = await identifiersOf(file.path, text, language, input);
        findings.push(...findingsFor(input, policy, identifiers, file.path));
    }
    return findings;
}

function pathIdentifiers(input: EngineInput): Identifier[] {
    const seen = new Set<string>();
    return sourceFiles(input).flatMap(({ file, language }) => {
        const all = [fileIdentifier(file.path, language), ...directoryIdentifiers(file.path, language)];
        return all.filter((identifier) => {
            const key = JSON.stringify([identifier.directory ?? identifier.file, identifier.language, identifier.name]);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

// A declaration applies throughout its subtree, including children with another selected language.
// Validate each authored layer once against the complete snapshot, not the changed-file partition.
async function schemaFindings(input: EngineInput): Promise<Finding[]> {
    const policy = input.policyFiles.policy;
    const selections = new Map(
        input.scopeEntries.map((scope) => [
            scope.path,
            languageConfigurations(selectForScope(policy, scope.path, input.manifests)),
        ]),
    );
    const observed: { path: string; names: string[] }[] = [];
    for (const file of input.files) {
        if (file.nature !== 'source') continue;
        const scope = scopeOf(file.path, input.scopeEntries);
        const language = selections.get(scope.path)?.find((manifest) => isClaimed(manifest.claims, file));
        if (language === undefined) continue;
        const name = language.configuration.name;
        const identifiers = await identifiersOf(
            file.path,
            readSource(input.root, file.path, input.observations).toString('utf8'),
            name,
            input,
        );
        observed.push({
            path: file.path,
            names: [fileIdentifier(file.path, name), ...directoryIdentifiers(file.path, name), ...identifiers].map(
                (identifier) => identifier.name,
            ),
        });
    }
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
        const files = observed.filter((file) => isInScope(file.path, scope));
        const names = new Set(files.flatMap((file) => file.names));
        const unused = naming.allowed
            .filter((entry) => !names.has(entry.name))
            .map((entry) => `naming.allowed names "${entry.name}", which no identifier in this scope carries.`);
        const dead = naming.rules
            .filter((rule) => files.every((file) => !pathMatcher(rule.paths)(file.path)))
            .map((rule) => `A [[naming.rules]] entry matches no file: ${rule.paths.join(', ')}.`);
        const cases = naming.rules
            .flatMap((rule) => rule.case ?? [])
            .filter((name) => !isKnownCase(name))
            .map(
                (name) =>
                    `A [[naming.rules]] entry names the case "${name}", which is not one of camel, pascal, pascal-plus, kebab, snake, upper-snake or snake-migration.`,
            );
        const groups = naming.remove_groups
            .filter((entry) => !removable.has(entry.group))
            .map((entry) => `naming.remove_groups names "${entry.group}", which is not a removable group.`);
        return [...unused, ...dead, ...groups, ...cases].map((message) => ({
            check: input.spec.name,
            file: 'gspot.toml',
            message: scope === '' ? message : `${message} (scope ${scope})`,
            fixable: false,
        }));
    });
}

const ANALYSES: Record<string, (input: EngineInput, policy: EffectivePolicy) => Finding[] | Promise<Finding[]>> = {
    identifiers: identifierFindings,
    paths: (input, policy) =>
        pathIdentifiers(input).flatMap((identifier) => findingsFor(input, policy, [identifier], identifier.file)),
    'policy-schema': schemaFindings,
};

/**
 * Resolve the naming analysis while retaining policy preparation at execution time.
 * @param spec
 */
export function resolveNaming(spec: CheckSpec): Engine {
    const analysis = ANALYSES[spec.analysis ?? ''];
    if (analysis === undefined) throw new Error(`No naming analysis is called ${spec.analysis ?? ''}.`);
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
