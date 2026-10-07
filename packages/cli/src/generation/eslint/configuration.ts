// The parts of the ESLint configuration that the policy and the rendered scope decide.
import type { Session } from '#cli/types/planning.ts';
import { aliasesFor } from '#cli/repository/aliases.ts';
import type { EslintPresets } from '#cli/types/parsers/eslint.ts';
import { runtimeBlocks } from '#cli/generation/eslint/runtimes.ts';
import { eslintAllRulesSchema } from '#cli/parsers/schema/eslint.ts';
import { generatedIgnores } from '#cli/generation/ignore-patterns.ts';
import { isInScope, pathMatcher } from '#cli/repository/selectors.ts';
import { readEslintPresets } from '#cli/generation/eslint/presets.ts';
import type { TemplateInputs } from '#cli/types/generation/templates.ts';
import { tablesFor, harnessFolders, declaredArchitectures } from '#cli/policy/settings/lookup.ts';
import type { ScopeView, ScopeSelection, ArchitectureSettings } from '#cli/types/policy/settings.ts';
import type { EslintBlock, EslintContext, EslintConfiguration } from '#cli/types/generation/eslint.ts';
import ESLINT_ALL_RULES from '../../../configurations/language/javascript/eslint-all-rules.json' with { type: 'json' };

import {
    eslintRuleOptions,
    eslintIgnoreBlocks,
    manifestRuleBlocks,
    structuralRuleBlocks,
} from '#cli/generation/eslint/blocks.ts';
import {
    ESLINT_LIMITS,
    DIRECTION_ROLES,
    ESLINT_BOUNDARY_FOLDERS,
    ESLINT_JAVASCRIPT_LIMITS,
} from '#cli/config/generation/eslint.ts';
import {
    eslintModule,
    eslintErrorRules,
    eslintFilePatterns,
    eslintNodePatterns,
    eslintRuleSettings,
    eslintSourcePattern,
} from '#cli/generation/eslint/serialize.ts';

// The globs of a role: an element name stands for the paths of that element, and the fallback holds when unset.
function roleGlobs(architecture: ArchitectureSettings, name: string, defaults: string[]): string[] {
    const value = architecture.roles[name];
    const entries = value === undefined ? defaults : [value].flat();
    return entries.flatMap((entry) => architecture.modules.find((element) => element.name === entry)?.paths ?? [entry]);
}

// The roles import-direction orders, with the harness folders of the scope. A role the policy leaves out matches no file.
function directionRoles(architecture: ArchitectureSettings, harness: string[]): Record<string, string[]> {
    return {
        types: roleGlobs(architecture, 'types', []),
        harness: harness.map((folder) => `${folder}/**`),
        ...Object.fromEntries(DIRECTION_ROLES.map((role) => [role, roleGlobs(architecture, role, [])])),
    };
}

// Each nested scope resolves imports against its own aliases and harness folders.
function scopeBlocks(context: EslintContext): EslintBlock[] {
    const { root, reads, policy, scopes, nodeFiles } = context;
    if (policy.level !== 'all') return [];
    const folders = [
        ...ESLINT_BOUNDARY_FOLDERS,
        ...scopes.map((entry) => entry.scope.path).filter((path) => path !== ''),
    ];
    return scopes
        .filter((entry) => entry.scope.path !== '')
        .map((entry) => {
            const path = entry.scope.path;
            const aliases = aliasesFor(root, path, reads);
            const roles = directionRoles(policy.architecture, harnessFolders(policy, path));
            return {
                files: [
                    `${path}/${eslintSourcePattern('javascript', 'typescript')}`,
                    ...eslintNodePatterns(
                        nodeFiles.filter((file) => isInScope(file, path)),
                        '',
                    ),
                ],
                rules: {
                    'gspot/import-boundaries': ['error', { folders, aliases }],
                    'gspot/import-direction': ['error', { roles, aliases, scope: path }],
                },
            };
        });
}

// One boundaries block for each scope whose own architecture table declares elements. Element paths are relative to
// the scope that names them, so a nested scope never takes the elements of the root.
function boundaryBlocks(context: EslintContext): EslintBlock[] {
    const { policy, scopes, nodeFiles } = context;
    return declaredArchitectures(policy, scopes).map(({ selection: { scope, view }, architecture: table }) => {
        const { path } = scope;
        const prefix = path === '' ? '' : `${path}/`;
        // Each element is a category of files, because boundaries matches its element patterns against folders only.
        const categories = table.modules.map((element) => ({
            category: element.name,
            pattern: element.paths.map((pattern) => `${prefix}${pattern}`),
        }));
        const policies = table.imports_allowed.map((entry) => ({
            from: { file: { categories: entry.from } },
            allow: { to: { file: { categories: { anyOf: entry.to } } } },
        }));
        return {
            files: [
                `${prefix}${eslintSourcePattern('javascript', 'typescript')}`,
                ...eslintNodePatterns(
                    nodeFiles.filter((file) => isInScope(file, path)),
                    '',
                ),
            ],
            settings: {
                'boundaries/files': categories,
                'boundaries/ignore': (view.settings['tests'] as string[]).map((pattern) => `${prefix}${pattern}`),
            },
            rules: { 'boundaries/dependencies': ['error', { default: 'disallow', policies }] },
        };
    });
}

// The gspot rules the all level adds: import layout, direction, ownership, and re-exports.
function allLevelRules(context: EslintContext, aliases: Record<string, string>, roles: Record<string, string[]>) {
    const { structure } = context.policy;
    const scopePaths = context.scopes.map((entry) => entry.scope.path).filter((path) => path !== '');
    const reexports =
        structure.reexports === 'none'
            ? { 'gspot/no-reexports': 'error' }
            : { 'gspot/no-reexports': ['error', { allowIndex: true }] };
    return {
        'gspot/instances-in-registry': 'error',
        'gspot/no-alias-exports': 'error',
        'gspot/no-index-imports': 'error',
        'gspot/header-first': 'error',
        'gspot/sort-imports': 'error',
        'gspot/sort-exports': 'error',
        'gspot/import-boundaries': ['error', { folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths], aliases }],
        'import-x/exports-last': 'error',
        'gspot/import-direction': ['error', { roles, aliases }],
        'gspot/env-owner': ['error', { owners: roles['env'] }],
        ...reexports,
    };
}

// The structural ceilings and all-level rules the policy decides.
function gspotRules(context: EslintContext, aliases: Record<string, string>, limits: EslintConfiguration['limits']) {
    const { policy, selection } = context;
    const { architecture } = policy;
    const roles = directionRoles(architecture, harnessFolders(policy, selection.scope.path));
    const barrels = { 'gspot/max-barrel-reexports': ['error', { max: limits['barrelReexports'] }] };
    return {
        ...(policy.level === 'all' ? allLevelRules(context, aliases, roles) : {}),
        ...(policy.level === 'all' && policy.structure.reexports !== 'none' ? barrels : {}),
    };
}

// The limits of one language, each falling back to the general limit.
function limitsOf(view: ScopeView, language: string, keys: Record<string, string>): EslintConfiguration['limits'] {
    return Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, view.limit(key, language)]));
}

// The effective test patterns and ESLint settings, including the selected configuration defaults.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Reading these effective settings inside eslintConfiguration puts it over the complexity limit.
function eslintSettings(view: ScopeView) {
    const { settings } = view;
    return {
        testFiles: settings['tests'] as string[],
        scriptFiles: settings['tools.eslint.script_files'] as string[],
        restrictedImports: settings['tools.eslint.restricted_imports'] as unknown[],
    };
}

// The [tools.eslint.verbatim] block without its reason, when it sets anything.
function extraBlock(context: EslintContext): EslintConfiguration['verbatim'] {
    const { policy, selection } = context;
    const entries = selection.view.verbatim('eslint');
    if (entries === undefined || Object.keys(entries).length === 0) return undefined;
    const reasons = tablesFor(policy, selection.scope.path)
        .map(({ table }) => table.tools?.['eslint']?.verbatim?.reason)
        .filter((reason) => reason !== undefined);
    return { reason: reasons.at(-1), entries };
}

/**
 * The parts of the ESLint configuration the policy decides: limits, rule options, file sets, and override blocks.
 * @param context the repository policy, resolved scopes, and authored Node file paths
 * @returns the values, ready to serialize into the configuration
 */
export function eslintConfiguration(context: EslintContext): EslintConfiguration {
    const { root, reads, policy, scopes, selection, nodeFiles } = context;
    const { view } = selection;
    const tool = view.options('tools.eslint');
    const aliases = aliasesFor(root, '', reads);
    const limits = limitsOf(view, 'typescript', ESLINT_LIMITS);
    const internalPrefixes = ['./', '../', ...Object.keys(aliases)];
    const importStyle = tool['import_extensions'] as Record<string, string> | undefined;
    return {
        aliases,
        nodeFiles,
        ...eslintSettings(view),
        limits,
        javascriptLimits: limitsOf(view, 'javascript', ESLINT_JAVASCRIPT_LIMITS),
        gspotRules: gspotRules(context, aliases, limits),
        importLayoutRules:
            policy.level === 'all'
                ? {
                      'import-x/first': 'error',
                      'import-x/newline-after-import': ['error', { count: 1 }],
                  }
                : {},
        commentLevel: policy.require_reasons ? 'error' : 'off',
        importStyleBlocks: (importStyle === undefined ? [] : Object.entries(importStyle)).map(([glob, style]) => ({
            files: [eslintSourcePattern('javascript', 'typescript'), ...eslintNodePatterns(nodeFiles, '')].map(
                (pattern) => [glob, pattern],
            ),
            rules: { 'gspot/import-extensions': ['error', { style, internalPrefixes }] },
        })),
        runtimes: runtimeBlocks(scopes),
        boundaryBlocks: boundaryBlocks(context),
        scopeBlocks: scopeBlocks(context),
        ignoredPaths: generatedIgnores(
            policy.declarations.flatMap((entry) => entry.paths),
            [],
        ),
        verbatim: extraBlock(context),
    };
}

/**
 * Bind rule data and preset reads to one generation run without acquiring installed tools.
 * @param session the repository and parsed policy of this run
 * @param selection the current scope
 * @returns the data and callbacks used by the ESLint render assets
 */
export function eslintInputs(
    session: Session,
    selection: ScopeSelection,
): Pick<
    TemplateInputs,
    | 'eslint'
    | 'eslintPolicy'
    | 'eslintAllRules'
    | 'eslintModule'
    | 'eslintFiles'
    | 'eslintFragmentBlocks'
    | 'eslintRuleSettings'
    | 'eslintErrorRules'
    | 'eslintPresets'
> {
    const { root, reads, scopes, policyFiles, repository } = session;
    const { policy } = policyFiles;
    const allRules = eslintAllRulesSchema.parse(ESLINT_ALL_RULES);
    const presets = new Map<string, EslintPresets>();
    const recognized = pathMatcher([eslintSourcePattern('javascript', 'typescript')]);
    const nodeFiles = repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes('shebang:node'))
        .map((file) => file.path);
    const eslintFiles = eslintFilePatterns({
        components: [],
        nodeFiles,
        tests: (selection.view.settings['tests'] ?? []) as string[],
        scripts: (selection.view.settings['tools.eslint.script_files'] ?? []) as string[],
    });
    const context = { root, reads, policy, scopes, selection, nodeFiles };
    let configuration: EslintConfiguration | undefined;
    return {
        eslint: () => (configuration ??= eslintConfiguration(context)),
        eslintPolicy: () => [
            ...structuralRuleBlocks(context),
            ...manifestRuleBlocks(scopes, policy),
            ...eslintIgnoreBlocks(policy),
        ],
        eslintAllRules: allRules,
        eslintModule: eslintModule({
            allRules,
            isAll: policy.level === 'all',
            codeFiles: eslintFiles.code,
            ruleOptions: eslintRuleOptions(policy),
        }),
        eslintFiles,
        eslintFragmentBlocks: [],
        eslintRuleSettings: eslintRuleSettings,
        eslintErrorRules,
        eslintPresets: (name) => {
            let preset = presets.get(name);
            if (preset !== undefined) return preset;
            const manifest = session.manifests.get(name);
            if (manifest === undefined) throw new Error(`No configuration owns the ${name} ESLint presets.`);
            preset = readEslintPresets(manifest);
            presets.set(name, preset);
            return preset;
        },
    };
}
