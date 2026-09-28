import { eta } from '#cli/generation/registry.ts';
import { stringify as stringifyYaml } from 'yaml';
import { readAsset } from '#cli/platform/assets.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { PROSE_FORMATS } from '#cli/configurations/vale.ts';
import { styleNames } from '#cli/generation/vale-styles.ts';
import type { TemplateInputs } from '#cli/types/generation.ts';
import { TomlDate, stringify as stringifyToml } from 'smol-toml';
import { policyValue, roleFolders } from '#cli/policy/settings.ts';
import { markdownlintRules } from '#cli/generation/markdownlint.ts';
import type { TrackedFile } from '#cli/types/repository/repository.ts';
import { scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/policy.ts';
import { ESLINT_RULE_LEVELS } from '#cli/constants/checks/eslint-levels.ts';
import { BLOCK_IGNORES, TOKEN_IGNORES } from '#cli/constants/configurations.ts';
import { ALL_COMPILER_OPTIONS } from '#cli/checks/typescript/compiler-options.ts';
import { RECOMMENDED_COMPILER_OPTIONS } from '#cli/constants/checks/typescript.ts';
import { aliasesFor, javascriptConfiguration } from '#cli/generation/javascript.ts';
import { headerFor, headerLines, jsonHeaderAdded } from '#cli/generation/headers.ts';
import { JSON_EXTENSIONS, LEADING_NEWLINES, PACKAGE_JSON_INDENT } from '#cli/constants/generation.ts';
import { editorconfigOverrides, prettierConfiguration } from '#cli/generation/formatting/settings.ts';
import { eslintRuleBlocks, manifestRuleBlocks, structuralRuleBlocks } from '#cli/generation/eslint.ts';

function prefixed(path: string, pattern: string): string {
    if (path === '') return pattern;
    return pattern.startsWith('!') ? `!${path}/${pattern.slice(1)}` : `${path}/${pattern}`;
}

// The entry files of a scope: what its policy declares, then what its selected configurations know.
function entryFiles(policy: Policy, scopes: ScopeSelection[], scope: string): string[] {
    const layers = [
        { path: '', table: policy },
        ...Object.entries(policy.scopeTables)
            .filter(([path]) => path === scope || scope.startsWith(`${path}/`))
            .map(([path, table]) => ({ path, table })),
    ];
    const authored = layers.flatMap(({ path, table }) => {
        const entries = (policyValue(table, 'tools.knip.entry')?.value ?? []) as string[];
        return entries.map((pattern) => prefixed(path, pattern));
    });
    const selected = scopes.find((entry) => entry.scope.path === scope)?.selected ?? [];
    const declared = selected.flatMap((manifest) => manifest.entry_files).map((pattern) => prefixed(scope, pattern));
    return [...new Set([...authored, ...declared])];
}

function byDepth(scopes: ScopeSelection[]): ScopeSelection[] {
    return scopes.toSorted(
        (left, right) =>
            left.scope.path.split('/').length - right.scope.path.split('/').length ||
            left.scope.path.localeCompare(right.scope.path),
    );
}

function scopeInputs(policy: Policy, scopes: ScopeSelection[], selection: ScopeSelection) {
    const { view } = selection;
    const tools = scopes.flatMap((entry) => entry.selected.flatMap((manifest) => manifest.tools));
    const names = [...new Set(tools.map((tool) => tool.name))].toSorted((a, b) => a.localeCompare(b));
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
    return {
        prettierConfig: (targetPath: string) =>
            prettierConfiguration(policy, targetPath, view.extra('prettier'), plugins),
        scope: selection.scope.path,
        scopes: scopes
            .filter((entry) => entry.scope.path !== '')
            .map((entry) => ({
                path: entry.scope.path,
                configurations: entry.selected.map((manifest) => manifest.configuration.name),
            })),
        configurationScopes: (configuration: string) =>
            byDepth(scopes.filter((entry) => entry.view.configurations.includes(configuration))).map((entry) => ({
                path: entry.scope.path,
                settings: entry.view.settings,
                extra: entry.view.extra,
            })),
        roleFolders: (role: string) => roleFolders(selection.selected, view.settings, role),
        roleScopes: (role: string) =>
            byDepth(scopes)
                .map((entry) => ({
                    path: entry.scope.path,
                    folders: roleFolders(entry.selected, entry.view.settings, role),
                }))
                .filter((entry) => entry.folders.length > 0),
        configurations: view.configurations,
        policy: policy,
        view,
        format: view.format,
        settings: view.settings,
        tool: view.tool,
        entryFiles: (scope: string) => entryFiles(policy, scopes, scope),
        limit: view.limit,
        rulesOff: view.rulesOff,
        ignoresFor: view.ignoresFor,
        extra: view.extra,
        tools: names,
        toolPackages: packages,
    };
}

/**
 * The inputs every template sees.
 * @param root the repository root.
 * @param policy the repository policy.
 * @param sourceFiles the tracked files.
 * @param scopes every resolved scope.
 * @param selection the scope being rendered.
 * @param version the gspot version the header names.
 * @returns the template inputs, with empty fragment parts the generator fills per target.
 */
export function templateInputs(
    root: string,
    policy: Policy,
    sourceFiles: TrackedFile[],
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    version: string,
): TemplateInputs {
    const { view } = selection;
    const files = (extension: string): string[] =>
        sourceFiles
            .filter((file) => file.path.endsWith(extension) && file.nature === 'source')
            .map((file) => file.path);
    return {
        ...scopeInputs(policy, scopes, selection),
        javascriptConfig: (targetPath) => javascriptConfiguration(root, policy, targetPath, selection.scope.path),
        markdownlintRules: markdownlintRules(view, policy.level === 'all'),
        scopeIgnorePatterns,
        editorconfigOverrides: () => editorconfigOverrides(policy),
        eslintPolicy: [
            ...structuralRuleBlocks(scopes, policy),
            ...manifestRuleBlocks(scopes, policy),
            ...eslintRuleBlocks(policy),
        ],
        eslintRuleLevels: ESLINT_RULE_LEVELS,
        isAll: policy.level === 'all',
        typescriptOptions: policy.level === 'all' ? ALL_COMPILER_OPTIONS : RECOMMENDED_COMPILER_OPTIONS,
        prose: {
            styles: styleNames(),
            blockIgnores: BLOCK_IGNORES,
            tokenIgnores: TOKEN_IGNORES,
            formats: PROSE_FORMATS,
        },
        version: version,
        fragments: '',
        fragmentImports: '',
        fragmentFiles: [],
        fragmentSelectors: [],
        json: (value, indent = PACKAGE_JSON_INDENT) =>
            JSON.stringify(value, null, indent)
                .replaceAll('\u{2028}', String.raw`\u2028`)
                .replaceAll('\u{2029}', String.raw`\u2029`),
        toml: stringifyToml,
        yaml: stringifyYaml,
        tomlDate: TomlDate,
        importAliases: (scope) => aliasesFor(root, scope),
        files,
        header: headerFor('x.toml', version),
        headerLines: headerLines(version),
    };
}

/**
 * Renders a configuration template asset to the final text of a target, header included unless the target's reader refuses unknown keys.
 * @param templatePath the asset path of the template.
 * @param targetPath the path the text is written to.
 * @param inputs the template inputs.
 * @param isHeaderWanted false for a reader that refuses the header key or comment.
 * @returns the text to write.
 */
export function emitTarget(
    templatePath: string,
    targetPath: string,
    inputs: TemplateInputs,
    isHeaderWanted = true,
): string {
    const rendered = eta.renderString(readAsset(templatePath), { ...inputs, targetPath });
    if (JSON_EXTENSIONS.has(extensionOf(targetPath))) {
        const format = { width: inputs.format.print_width, indent: inputs.format.indent_width };
        if (!isHeaderWanted) return jsonText(JSON.parse(rendered), format);
        return jsonHeaderAdded(rendered, inputs.version, format);
    }
    const body = rendered.replace(LEADING_NEWLINES, '').trimEnd() + '\n';
    if (!isHeaderWanted) return body;
    return `${headerFor(targetPath, inputs.version)}${body}`;
}
