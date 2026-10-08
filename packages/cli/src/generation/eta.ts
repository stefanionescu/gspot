// Emit tool-file assets with the effective settings and inputs of their scope.
import { Eta } from 'eta';
import { stringify as stringifyYaml } from 'yaml';
import { readAsset } from '#cli/platform/assets.ts';
import { basename, relative } from 'node:path/posix';
import { extensionOf } from '#cli/platform/paths.ts';
import type { Session } from '#cli/types/planning.ts';
import { pythonInputs } from '#cli/generation/python.ts';
import { VALE_PACKAGES } from '#cli/config/tools/vale.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { buildJsconfig } from '#cli/generation/jsconfig.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { packageWorkspaces } from '#cli/repository/scopes.ts';
import { readSwiftVersion } from '#cli/parsers/swift/source.ts';
import { PROSE_GRAMMARS } from '#cli/config/generation/prose.ts';
import { TomlDate, stringify as stringifyToml } from 'smol-toml';
import { TEST_RULE_NAMES } from '#cli/config/generation/eslint.ts';
import { JSON_EXTENSIONS } from '#cli/config/generation/headers.ts';
import { frozenMigrationPaths } from '#cli/parsers/sql/migrations.ts';
import { headerFor, addJsonHeader } from '#cli/generation/headers.ts';
import { eslintInputs } from '#cli/generation/eslint/configuration.ts';
import { isInScope, byScopeDepth } from '#cli/repository/selectors.ts';
import { tablesFor, policyValue } from '#cli/policy/settings/lookup.ts';
import { HTML_RULES, HTML_ALL_RULES } from '#cli/config/generation/html.ts';
import { stylelintRuleNamesSchema } from '#cli/parsers/schema/stylelint.ts';
import type { EtaInputs, ScopeEtaInputs } from '#cli/types/generation/eta.ts';
import { buildTsconfig, requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import type { Policy, ScopeView, ScopeSelection } from '#cli/types/policy/settings.ts';
import { editorconfigOverrides, prettierConfiguration } from '#cli/generation/formatting.ts';
import { scopeIgnorePatterns, selectedIgnorePaths } from '#cli/generation/ignore-patterns.ts';
import { readPackageManifests, getProjectDependencies } from '#cli/repository/package-manifests.ts';
import nativeStylelintRuleNames from '../../configurations/language/css/rule-names.json' with { type: 'json' };

import {
    ETA_OPTIONS,
    JSON_INDENT,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    LEADING_NEWLINES,
} from '#cli/config/generation/eta.ts';

function proseInputs(session: Session, manifests: Manifest[]): EtaInputs['prose'] {
    const words = Object.keys(session.policyFiles.policy.words);
    return {
        packages: VALE_PACKAGES,
        words: words,
        products: [
            ...new Set([
                ...session.scopes.flatMap(({ selected }) =>
                    selected.flatMap((manifest) => manifest.tools.map((tool) => tool.name)),
                ),
                ...words,
            ]),
        ],
        rules: manifests.flatMap((manifest) =>
            manifest.toolFiles
                .filter((file) => file.tool.includes('vale') && file.target.endsWith('.yml'))
                .map((file) => basename(file.target, '.yml')),
        ),
        blockIgnores: BLOCK_IGNORES,
        tokenIgnores: TOKEN_IGNORES,
        formats: Object.entries(PROSE_GRAMMARS).flatMap(([extension, grammar]): [string, string][] =>
            grammar.format === undefined ? [] : [[extension.slice(1), grammar.format]],
        ),
    };
}
const stylelintRuleNames = stylelintRuleNamesSchema.parse(nativeStylelintRuleNames).rules;

function prefixed(path: string, pattern: string): string {
    if (path === '') return pattern;
    return pattern.startsWith('!') ? `!${path}/${pattern.slice(1)}` : `${path}/${pattern}`;
}

// The entry files of a folder: what the policy declares for it, then what the configurations of the deepest scope around it know.
function entryFiles(policy: Policy, scopes: ScopeSelection[], scope: string): string[] {
    const authored = tablesFor(policy, scope).flatMap(({ path, table }) => {
        const entries = (policyValue(table, 'tools.knip.entry')?.value ?? []) as string[];
        return entries.map((pattern) => prefixed(path, pattern));
    });
    const owner = scopes
        .filter((entry) => isInScope(scope, entry.scope.path))
        .toSorted((left, right) => byScopeDepth(right.scope.path, left.scope.path))[0];
    const selected = owner?.selected ?? [];
    const declared = selected.flatMap((manifest) => manifest.entry).map((pattern) => prefixed(scope, pattern));
    return [...new Set([...authored, ...declared])];
}

// Resolve target rules, then the selected level and the check's finding ignores.
function htmlRules(view: ScopeView, level: Policy['level'], check: string, overrides: Record<string, unknown> = {}) {
    const rules: Record<string, unknown> = { ...HTML_RULES, ...overrides };
    const ignored = [...(level === 'all' ? [] : HTML_ALL_RULES), ...view.rulesOff(check)];
    for (const rule of ignored) rules[rule] = 'off';
    return rules;
}

function scopeInputs(input: ScopeEtaInputs) {
    const { session, selection, manifests, projects } = input;
    const { scopes } = session;
    const { policy } = session.policyFiles;
    const { view } = selection;
    const tools = collectPins(manifests);
    const packages = [
        ...new Set(
            tools.flatMap((tool) => (tool.installers['npm']?.name === undefined ? [] : [tool.installers['npm'].name])),
        ),
    ].toSorted((a, b) => a.localeCompare(b));
    const plugins = selection.selected
        .flatMap((manifest) => manifest.tools)
        .flatMap((tool) => {
            const name = tool.installers['npm']?.name;
            return tool.prettier === undefined || name === undefined
                ? []
                : [{ name, entry: tool.prettier.entry, overrides: tool.prettier.overrides }];
        });
    const formatting = { policy, format: view.format, verbatim: view.verbatim('prettier'), plugins };
    return {
        ...pythonInputs(session, selection),
        prettierConfig: (targetPath: string) => prettierConfiguration({ ...formatting, targetPath }),
        scope: selection.scope.path,
        relative,
        scopeDependencies: Object.keys(getProjectDependencies(projects, selection.scope.path)),
        scopes: scopes
            .filter((entry) => entry.scope.path !== '')
            .map((entry) => ({
                path: entry.scope.path,
                configurations: entry.selected.map((manifest) => manifest.configuration.name),
            })),
        configurationScopes: (configuration: string) =>
            scopes
                .filter((entry) => entry.view.configurations.includes(configuration))
                .toSorted((left, right) => byScopeDepth(left.scope.path, right.scope.path))
                .map((entry) => ({
                    path: entry.scope.path,
                    settings: entry.view.settings,
                    dependencies: Object.keys(getProjectDependencies(projects, entry.scope.path)),
                    verbatim: entry.view.verbatim,
                })),
        ignoredPaths: selectedIgnorePaths(scopes),
        configurations: view.configurations,
        policy,
        format: view.format,
        roles: view.roles,
        settings: view.settings,
        options: view.options,
        entryFiles: (scope: string) => entryFiles(policy, scopes, scope),
        limit: view.limit,
        rulesOff: view.rulesOff,
        ignoresFor: view.ignoresFor,
        verbatim: view.verbatim,
        testRuleNames: TEST_RULE_NAMES,
        stylelintRuleNames,
        toolBinaries: tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name),
        toolPackages: packages,
    };
}

/** Shared template compilation preserves identical options for targets and fragments. */
export const eta = new Eta(ETA_OPTIONS);

/**
 * The inputs every template sees.
 * @param session the repository, policy, scope selections, and release version.
 * @param selection the scope being emitted.
 * @param manifests the applicable configuration manifests with only their required tools.
 * @returns the template inputs, with empty fragment parts the generator fills per target.
 */
export function etaInputs(session: Session, selection: ScopeSelection, manifests: Manifest[]): EtaInputs {
    const { root, reads, scopes, version } = session;
    const { policy } = session.policyFiles;
    const sourceFiles = session.repository.files;
    const { view } = selection;
    const compilerOptions = Object.entries(requiredTsconfigOptions(policy.level, selection.selected)).filter(
        ([option]) => !view.rulesOff('typescript/tsconfig').includes(option),
    );
    const compilerContext = {
        root,
        reads,
        files: sourceFiles,
        scopeEntries: scopes.map((entry) => entry.scope),
        scope: selection.scope.path,
    };
    return {
        ...scopeInputs({ session, selection, manifests, projects: readPackageManifests(root, sourceFiles) }),
        ...eslintInputs(session, selection),
        javascriptConfig: (target) =>
            buildJsconfig({
                ...compilerContext,
                declarationPaths: policy.declarations.flatMap((entry) => entry.paths),
                importStyles: view.options('tools.eslint')['import_extensions'],
                target,
            }),
        scopeIgnorePatterns,
        frozenMigrationPaths,
        swiftVersion: () => readSwiftVersion(compilerContext, view.options('swift').xcode_project),
        editorconfigOverrides: () => editorconfigOverrides(policy),
        isAll: policy.level === 'all',
        htmlRules: htmlRules.bind(undefined, view, policy.level),
        typescriptConfig: (target) =>
            buildTsconfig({
                ...compilerContext,
                target,
                options: Object.fromEntries(compilerOptions),
            }),
        prose: proseInputs(session, manifests),
        version: version,
        fragments: '',
        fragmentParts: [],
        fragmentImports: '',
        fragmentFiles: [],
        fragmentSelectors: [],
        json: (value, indent = JSON_INDENT) =>
            JSON.stringify(value, null, indent)
                .replaceAll('\u{2028}', String.raw`\u2028`)
                .replaceAll('\u{2029}', String.raw`\u2029`),
        toml: stringifyToml,
        yaml: stringifyYaml,
        tomlDate: TomlDate,
        packageWorkspaces: () => packageWorkspaces(root),
        files: (extension) =>
            sourceFiles.flatMap((file) => (file.path.endsWith(extension) && file.kind === 'source' ? [file.path] : [])),
    };
}

/**
 * Emits an Eta source to the final text of a target, header included unless the target's reader refuses unknown keys.
 * @param templatePath the asset path of the template.
 * @param targetPath the path the text is written to.
 * @param inputs the template inputs.
 * @param isHeaderWanted false for a reader that refuses the header key or comment.
 * @returns the text to write.
 */
export function emitTarget(
    templatePath: string,
    targetPath: string,
    inputs: EtaInputs,
    isHeaderWanted: boolean,
): string {
    const emitted = eta.renderString(readAsset(templatePath), { ...inputs, targetPath });
    if (JSON_EXTENSIONS.has(extensionOf(targetPath))) {
        const format = { width: inputs.format.print_width, indent: inputs.format.indent_width };
        if (!isHeaderWanted) return jsonText(JSON.parse(emitted), format);
        return addJsonHeader(emitted, inputs.version, format);
    }
    const body = emitted.replace(LEADING_NEWLINES, '').trimEnd() + '\n';
    if (!isHeaderWanted) return body;
    return `${headerFor(targetPath, inputs.version)}${body}`;
}
