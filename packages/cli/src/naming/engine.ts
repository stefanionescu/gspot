// The naming engine: identifiers, paths and the policy schema, as one function per analysis.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { isKnownCase } from '#cli/naming/cases.ts';
import { nameFinding } from '#cli/naming/report.ts';
import { identifiersOf } from '#cli/naming/extract.ts';
import { nameProblems } from '#cli/naming/validate.ts';
import type { TrackedFile } from '#types/repository.ts';
import { effectivePolicy } from '#cli/naming/policy.ts';
import { languagePresets } from '#cli/presets/select.ts';
import { isClaimed, pathMatcher } from '#cli/presets/claims.ts';
import { directoryIdentifiers, fileIdentifier } from '#cli/naming/paths.ts';
import type { EffectivePolicy, Identifier, NamingContext } from '#types/naming.ts';

const REACT_FILE = /\.[jt]sx$/u;
const TEST_FILE = /(?:(?:^|\/)(?:tests?|__tests__)\/)|(?:\.(?:test|spec)\.[^./]+$)/u;

function languageOf(input: EngineInput, file: TrackedFile): string | undefined {
    const selection = input.session.scopes.find((entry) => entry.scope.path === input.scope);
    const languages = selection === undefined ? [] : languagePresets(selection.selected);
    return languages.find((manifest) => isClaimed(manifest.claims, file))?.preset.id;
}

function policyFor(input: EngineInput): EffectivePolicy | undefined {
    const selection = input.session.scopes.find((entry) => entry.scope.path === input.scope);
    return selection === undefined
        ? undefined
        : effectivePolicy(selection.surface, input.session.policyFiles.policy, input.scope);
}

function sourceFiles(input: EngineInput): { file: TrackedFile; language: string }[] {
    return input.files
        .filter((file) => file.nature === 'source')
        .map((file) => ({ file, language: languageOf(input, file) }))
        .filter((entry): entry is { file: TrackedFile; language: string } => entry.language !== undefined);
}

function findingsFor(input: EngineInput, policy: EffectivePolicy, identifiers: Identifier[], path: string): Finding[] {
    const context: NamingContext = { policy, isReactFile: REACT_FILE.test(path), isTestFile: TEST_FILE.test(path) };
    return identifiers.flatMap((identifier) =>
        nameProblems(identifier, context).map((problem) => nameFinding(input.spec.id, identifier, problem)),
    );
}

async function identifierFindings(input: EngineInput, policy: EffectivePolicy): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const { file, language } of sourceFiles(input)) {
        const text = readFileSync(join(input.root, file.path), 'utf8');
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
            const key = `${identifier.directory ?? identifier.file}\n${identifier.language}\n${identifier.name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    });
}

async function schemaFindings(input: EngineInput, policy: EffectivePolicy): Promise<Finding[]> {
    const names = new Set(pathIdentifiers(input).map((identifier) => identifier.name));
    for (const { file, language } of sourceFiles(input)) {
        const identifiers = await identifiersOf(file.path, readFileSync(join(input.root, file.path), 'utf8'), language);
        for (const identifier of identifiers) names.add(identifier.name);
    }
    const naming = input.session.policyFiles.policy.naming;
    const paths = input.session.repository.files.map((file) => file.path);
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
        Object.entries(policy.languages).length === 0
            ? []
            : ['containers', 'roles', 'verbs', 'verbs-strict', 'conjunctions', 'test'],
    );
    const groups = naming.remove_groups
        .filter((entry) => !removable.has(entry.group))
        .map((entry) => `naming.remove_groups names "${entry.group}", which is not a removable group.`);
    return [...unused, ...dead, ...groups, ...caseNames].map((text) => ({
        check: input.spec.id,
        file: 'gspot.toml',
        message: text,
        fixable: false,
    }));
}

/**
 * Runs the analysis a naming check names: identifiers, paths or policy-schema.
 * @param input the engine input
 * @returns the findings
 */
export async function runNaming(input: EngineInput): Promise<Finding[]> {
    const policy = policyFor(input);
    if (policy === undefined) return [];
    const analysis = input.spec.analysis ?? '';
    if (analysis === 'identifiers') return identifierFindings(input, policy);
    if (analysis === 'paths')
        return pathIdentifiers(input).flatMap((identifier) =>
            findingsFor(input, policy, [identifier], identifier.file),
        );
    if (analysis === 'policy-schema') return schemaFindings(input, policy);
    throw new Error(`No naming analysis is called ${analysis}.`);
}
