// The parts of the ESLint configuration that the policy and the emitted scope decide.
import type { Session } from '#cli/types/planning.ts';
import { aliasesFor } from '#cli/repository/contracts.ts';
import { tablesFor } from '#cli/policy/settings/contracts.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import type { EslintPresets } from '#cli/types/parsers/eslint.ts';
import { boundaryBlocks } from '#cli/generation/eslint/boundaries.ts';
import { generatedIgnores } from '#cli/generation/documents/contracts.ts';
import type { ScopeView, ScopeSelection } from '#cli/types/policy/settings.ts';
import { scriptPaths, runtimeBlocks } from '#cli/generation/eslint/runtimes.ts';
import type { EslintBlock, EslintContext, EslintConfiguration } from '#cli/types/generation/eslint.ts';
import { ESLINT_LIMITS, ESLINT_BOUNDARY_FOLDERS, ESLINT_JAVASCRIPT_LIMITS } from '#cli/config/generation/eslint.ts';

import {
    eslintRuleOptions,
    importStyleBlocks,
    eslintIgnoreBlocks,
    manifestRuleBlocks,
    structuralRuleBlocks,
} from '#cli/generation/eslint/contracts.ts';
import {
    eslintModule,
    eslintErrorRules,
    readEslintPresets,
    eslintFilePatterns,
    eslintNodePatterns,
    eslintRuleSettings,
    eslintSourcePattern,
} from '#cli/generation/eslint/public.ts';

// Each nested scope resolves its import boundaries against its own aliases.
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
            return {
                files: [
                    `${path}/${eslintSourcePattern('javascript', 'typescript')}`,
                    ...eslintNodePatterns(nodeFiles, path),
                ],
                rules: {
                    'gspot/import-boundaries': ['error', { folders, aliases }],
                },
            };
        });
}

// The structural ceilings and native plugin options the all-level policy decides.
function gspotRules(context: EslintContext, aliases: Record<string, string>, limits: EslintConfiguration['limits']) {
    const { policy } = context;
    if (policy.level !== 'all') return {};
    const scopePaths = context.scopes.map((entry) => entry.scope.path).filter((path) => path !== '');
    return {
        'gspot/no-alias-exports': 'error',
        'gspot/no-index-imports': 'error',
        'gspot/header-first': 'error',
        'gspot/import-boundaries': ['error', { folders: [...ESLINT_BOUNDARY_FOLDERS, ...scopePaths], aliases }],
        'import-x/exports-last': 'error',
        ...(policy.structure.reexports === 'none'
            ? {}
            : {
                  'barrel-files/avoid-barrel-files': [
                      'error',
                      { amountOfExportsToConsiderModuleAsBarrel: limits['indexExports'] },
                  ],
              }),
    };
}

// The limits of one language, each falling back to the general limit.
function limitsOf(view: ScopeView, language: string, keys: Record<string, string>): EslintConfiguration['limits'] {
    return Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, view.limit(key, language)]));
}

// Native ESLint options and their separate authored reason.
function extraBlock(context: EslintContext): EslintConfiguration['verbatim'] {
    const { policy, selection } = context;
    const entries = selection.view.verbatim('eslint');
    if (entries === undefined || Object.keys(entries).length === 0) return undefined;
    const reasons = tablesFor(policy, selection.scope.path)
        .map(({ table }) => table.reasons?.['tools.eslint.verbatim'])
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
    return {
        aliases,
        nodeFiles,
        testFiles: view.test_files,
        scriptFiles: scriptPaths(context),
        restrictedImports: tool.restricted_imports,
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
        commentLevel: 'error',
        importStyleBlocks: importStyleBlocks(scopes, nodeFiles),
        runtimes: runtimeBlocks(policy, scopes),
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
 * @returns the data and callbacks for emitting the ESLint assets
 */
export function eslintInputs(
    session: Session,
    selection: ScopeSelection,
): Pick<
    EtaInputs,
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
    const allRules = new Set([...session.manifests.values()].flatMap((manifest) => [...manifest.eslint_all_rules]));
    const presets = new Map<string, EslintPresets>();
    const recognized = pathMatcher([eslintSourcePattern('javascript', 'typescript')]);
    const nodeFiles = repository.files
        .filter((file) => !recognized(file.path) && file.kind === 'source' && file.tags.includes('shebang:node'))
        .map((file) => file.path);
    const eslintFiles = eslintFilePatterns({
        components: [],
        nodeFiles,
        tests: selection.view.test_files,
        scripts: scriptPaths({ policy, selection }),
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
