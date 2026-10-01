// The parts of the ESLint configuration that the policy and the rendered scope decide.
import { roleFolders } from '#cli/policy/settings.ts';
import { aliasesFor } from '#cli/generation/javascript.ts';
import type { EslintBlock, EslintContext, EslintConfiguration } from '#cli/types/generation.ts';
import type { Policy, MergedView, ScopeSelection, ArchitectureSettings } from '#cli/types/policy/policy.ts';

import {
    ESLINT_LIMITS,
    REGISTRY_FILES,
    ESLINT_CODE_FILES,
    DIRECTION_DEFAULTS,
    DEFAULT_NODE_VERSION,
    ESLINT_JAVASCRIPT_LIMITS,
} from '#cli/config/generation.ts';

// The globs of a role: an element name stands for the paths of that element, and the fallback holds when unset.
function roleGlobs(architecture: ArchitectureSettings, name: string, defaults: string[]): string[] {
    const value = architecture.roles[name];
    const entries = value === undefined ? defaults : [value].flat();
    return entries.flatMap(
        (entry) => architecture.elements.find((element) => element.name === entry)?.paths ?? [entry],
    );
}

// The roles import-direction orders, with the harness folders of the scope.
function directionRoles(architecture: ArchitectureSettings, harness: string[]): Record<string, string[]> {
    const types = architecture.types_directory ?? 'types';
    return {
        types: roleGlobs(architecture, 'types', [`${types}/**`, `**/${types}/**`]),
        harness: roleGlobs(
            architecture,
            'harness',
            harness.map((folder) => `${folder}/**`),
        ),
        ...Object.fromEntries(
            Object.entries(DIRECTION_DEFAULTS).map(([role, globs]) => [role, roleGlobs(architecture, role, globs)]),
        ),
    };
}

// Each nested scope resolves imports against its own aliases and harness folders.
function scopeBlocks(context: EslintContext): EslintBlock[] {
    const { root, policy, scopes, selection } = context;
    if (policy.level !== 'all') return [];
    const rootHarness = roleFolders(selection.selected, selection.view.settings, 'harness');
    return scopes
        .filter((entry) => entry.scope.path !== '')
        .map((entry) => {
            const path = entry.scope.path;
            const aliases = aliasesFor(root, path);
            const folders = roleFolders(entry.selected, entry.view.settings, 'harness');
            const roles = directionRoles(policy.architecture, folders.length > 0 ? folders : rootHarness);
            const crossFolder = { 'gspot/no-cross-folder-imports': ['error', { aliases }] };
            return {
                files: [`${path}/${ESLINT_CODE_FILES}`],
                rules: {
                    ...(Object.keys(aliases).length === 0 ? {} : crossFolder),
                    'gspot/import-direction': ['error', { roles, aliases, scope: path }],
                },
            };
        });
}

// One boundaries block for each scope whose architecture table declares elements.
function boundaryBlocks(policy: Policy, scopes: ScopeSelection[]): EslintBlock[] {
    const paths = ['', ...scopes.map((entry) => entry.scope.path).filter((path) => path !== '')];
    return paths.flatMap((path): EslintBlock[] => {
        const table = policy.scopeTables[path]?.architecture ?? policy.architecture;
        if (table.elements.length === 0) return [];
        const prefix = path === '' ? '' : `${path}/`;
        const elements = table.elements.map((element) => ({
            type: element.name,
            pattern: element.paths.map((pattern) => `${prefix}${pattern}`),
            mode: 'full',
        }));
        const edges = table.edges_allowed.map((entry) => ({ from: entry.from, allow: entry.to }));
        return [
            {
                files: [`${prefix}${ESLINT_CODE_FILES}`],
                settings: { 'boundaries/elements': elements, 'boundaries/ignore': ['**/*.test.*', '**/*.spec.*'] },
                rules: { 'boundaries/element-types': ['error', { default: 'disallow', rules: edges }] },
            },
        ];
    });
}

// The gspot rules the all level adds: import layout, direction, ownership, and re-exports.
function allLevelRules(context: EslintContext, aliases: Record<string, string>, roles: Record<string, string[]>) {
    const { architecture, structure } = context.policy;
    const scopePaths = context.scopes.map((entry) => entry.scope.path).filter((path) => path !== '');
    const config = architecture.config_directory;
    const reexports =
        structure.reexports === 'none'
            ? { 'gspot/no-reexports': 'error' }
            : { 'gspot/no-reexports': ['error', { allowIndex: true }] };
    return {
        'gspot/no-exported-alias-constants': 'error',
        'gspot/no-index-imports': 'error',
        'gspot/header-comments-before-imports': 'error',
        'gspot/no-import-comments': 'error',
        'gspot/import-layout': 'error',
        'gspot/export-layout': 'error',
        'gspot/no-cross-folder-imports': ['error', { aliases }],
        'gspot/no-cross-project-imports': ['error', { scopes: scopePaths }],
        'gspot/registry-instance-only':
            config === undefined
                ? 'error'
                : ['error', { registryFiles: [...REGISTRY_FILES, `${config}/**`, `**/${config}/**`] }],
        'gspot/private-before-public': 'error',
        'gspot/import-direction': ['error', { roles, aliases }],
        'gspot/env-access-owner': ['error', { owners: roles['env'] }],
        ...reexports,
    };
}

// The gspot rules the policy decides: the types folder, the trivial ceilings, and the all-level set.
function gspotRules(context: EslintContext, aliases: Record<string, string>, limits: EslintConfiguration['limits']) {
    const { policy, selection } = context;
    const { architecture } = policy;
    const roles = directionRoles(architecture, roleFolders(selection.selected, selection.view.settings, 'harness'));
    const trivial = { maxStatements: limits['trivialStatements'] };
    const barrels = { 'gspot/max-barrel-reexports': ['error', { max: limits['barrelReexports'] }] };
    return {
        ...(architecture.types_directory === undefined
            ? {}
            : { 'gspot/types-placement': ['error', { typesDirectory: architecture.types_directory }] }),
        'gspot/no-trivial-functions': ['error', trivial],
        'gspot/no-trivial-files': ['error', trivial],
        ...(policy.level === 'all' ? allLevelRules(context, aliases, roles) : {}),
        ...(policy.level === 'all' && policy.structure.reexports !== 'none' ? barrels : {}),
    };
}

// The limits of one language, each falling back to the general limit.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The TypeScript and JavaScript limits fall back to the general limit the same way.
function limitsOf(view: MergedView, language: string, keys: Record<string, string>): EslintConfiguration['limits'] {
    return Object.fromEntries(
        Object.entries(keys).map(([name, key]) => [name, view.limit(key, language) ?? view.limit(key)]),
    );
}

// The file sets and plain settings [tools.eslint] holds, with their defaults.
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Reading these four settings with their defaults inside eslintConfiguration puts it over the complexity limit.
function eslintSettings(view: MergedView) {
    const { settings } = view;
    return {
        testFiles: (settings['tools.eslint.test_files'] ?? []) as string[],
        scriptFiles: (settings['tools.eslint.script_files'] ?? []) as string[],
        nodeVersion: (settings['tools.eslint.node_version'] ?? DEFAULT_NODE_VERSION) as string,
        restrictedImports: (settings['tools.eslint.restricted_imports'] ?? []) as unknown[],
    };
}

// The [tools.eslint.extra] block without its reason, when it sets anything.
function extraBlock(view: MergedView): EslintConfiguration['extra'] {
    const extras = view.extra('eslint');
    if (extras === undefined) return undefined;
    const entries = Object.fromEntries(Object.entries(extras).filter(([key]) => key !== 'reason'));
    return Object.keys(entries).length === 0 ? undefined : { reason: extras['reason'], entries };
}

/**
 * The parts of the ESLint configuration the policy decides: limits, rule options, file sets, and override blocks.
 * @param context the repository root, the policy, every scope, and the scope being rendered
 * @returns the values, ready to serialize into the configuration
 */
export function eslintConfiguration(context: EslintContext): EslintConfiguration {
    const { root, policy, scopes, selection } = context;
    const { view } = selection;
    const tool = view.tool('eslint');
    const aliases = aliasesFor(root, '');
    const limits = limitsOf(view, 'typescript', ESLINT_LIMITS);
    const internalPrefixes = ['./', '../', ...Object.keys(aliases)];
    const importStyle = (tool['import_style'] ?? {}) as Record<string, string>;
    const globals = (tool['globals'] ?? {}) as Record<string, string>;
    return {
        aliases,
        ...eslintSettings(view),
        limits,
        javascriptLimits: limitsOf(view, 'javascript', ESLINT_JAVASCRIPT_LIMITS),
        gspotRules: gspotRules(context, aliases, limits),
        importLayoutRules:
            policy.level === 'all'
                ? {
                      'import-x/first': 'error',
                      'import-x/newline-after-import': ['error', { count: 1 }],
                      'import-x/exports-last': 'error',
                  }
                : {},
        commentLevel: policy.requireReasons ? 'error' : 'off',
        importStyleBlocks: Object.entries(importStyle).map(([glob, style]) => ({
            files: [[glob, ESLINT_CODE_FILES]],
            rules: { 'gspot/import-path-style': ['error', { style, internalPrefixes }] },
        })),
        runtimes: Object.entries(globals).map(([glob, runtime]) => ({
            files: [glob],
            runtime: runtime === 'worker' ? 'serviceworker' : runtime,
        })),
        boundaryBlocks: boundaryBlocks(policy, scopes),
        scopeBlocks: scopeBlocks(context),
        ignoredPaths: ['**/node_modules/**', '.gspot/**', ...policy.declarations.flatMap((entry) => entry.paths)],
        extra: extraBlock(view),
    };
}
