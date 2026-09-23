import { readSource } from '#cli/repository/tracked.ts';
import type { CheckSpec } from '#cli/presets/types.ts';
// The naming engine: identifiers, paths and the policy schema, as one function per analysis.
import type { Engine, EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { isKnownCase } from '#cli/naming/cases.ts';
import { identifiersOf } from '#cli/naming/extract.ts';
import type { TrackedFile } from '#cli/repository/types.ts';
import { languagePresets } from '#cli/presets/select.ts';
import { nameProblems } from '#cli/naming/validate-name.ts';
import { isClaimed, pathMatcher } from '#cli/presets/claims.ts';
import { effectivePolicy, shippedPolicy } from '#cli/naming/policy.ts';
import { directoryIdentifiers, fileIdentifier } from '#cli/naming/paths.ts';
import type { EffectivePolicy, Identifier, NamingContext } from '#cli/naming/types.ts';

const REACT_FILE = /\.[jt]sx$/u;
const TEST_FILE = /(?:(?:^|\/)(?:tests?|__tests__)\/)|(?:\.(?:test|spec)\.[^./]+$)/u;

function sourceFiles(input: EngineInput): { file: TrackedFile; language: string }[] {
    const languages = languagePresets(input.selection.selected);
    return input.files
        .filter((file) => file.nature === 'source')
        .map((file) => ({ file, language: languages.find((manifest) => isClaimed(manifest.claims, file))?.preset.name }))
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
        const text = readSource(input.root, file.path).toString('utf8');
        const identifiers = await identifiersOf(file.path, text, language);
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

async function schemaFindings(input: EngineInput): Promise<Finding[]> {
    const names = new Set(pathIdentifiers(input).map((identifier) => identifier.name));
    for (const { file, language } of sourceFiles(input)) {
        const identifiers = await identifiersOf(
            file.path,
            readSource(input.root, file.path).toString('utf8'),
            language,
        );
        for (const identifier of identifiers) names.add(identifier.name);
    }
    const naming = input.policyFiles.policy.naming;
    const paths = input.files.map((file) => file.path);
    const unused = naming.allowed
        .filter((entry) => !names.has(entry.name))
        .map((entry) => `naming.allowed names "${entry.name}", which no identifier in this scope carries.`);
    const dead = naming.rules
        .filter((rule) => paths.every((path) => !pathMatcher(rule.paths)(path)))
        .map((rule) => `A [[naming.rules]] entry matches no file: ${rule.paths.join(', ')}.`);
    const caseNames = naming.rules
        .flatMap((rule) => rule.case ?? [])
        .filter((name) => !isKnownCase(name))
        .map(
            (name) =>
                `A [[naming.rules]] entry names the case "${name}", which is not one of camel, pascal, pascal-plus, kebab, snake, upper-snake or snake-migration.`,
        );
    const removable = new Set(
        Object.entries(shippedPolicy().groups)
            .filter(([, group]) => group.removable)
            .map(([name]) => name),
    );
    const groups = naming.remove_groups
        .filter((entry) => !removable.has(entry.group))
        .map((entry) => `naming.remove_groups names "${entry.group}", which is not a removable group.`);
    return [...unused, ...dead, ...groups, ...caseNames].map((text) => ({
        check: input.spec.name,
        file: 'gspot.toml',
        message: text,
        fixable: false,
    }));
}

const ANALYSES: Record<string, (input: EngineInput, policy: EffectivePolicy) => Finding[] | Promise<Finding[]>> = {
    identifiers: identifierFindings,
    paths: (input, policy) =>
        pathIdentifiers(input).flatMap((identifier) => findingsFor(input, policy, [identifier], identifier.file)),
    'policy-schema': schemaFindings,
};

/** Resolve the naming analysis while retaining policy preparation at execution time. */
export function resolveNaming(spec: CheckSpec): Engine {
    const analysis = ANALYSES[spec.analysis ?? ''];
    if (analysis === undefined) throw new Error(`No naming analysis is called ${spec.analysis ?? ''}.`);
    return (input) => {
        const policy = effectivePolicy(input.selection.surface, input.policyFiles.policy, input.scope);
        return analysis(input, policy);
    };
}
