import { ALL_COMPILER_OPTIONS, RECOMMENDED_COMPILER_OPTIONS } from '#cli/checks/typescript/compiler-options.ts';
import { BLOCK_IGNORES, TOKEN_IGNORES } from '#cli/configurations/vale.ts';
import type { EslintRuleBlock } from '#cli/generation/eslint.ts';
import { eslintRuleBlocks, structuralRuleBlocks } from '#cli/generation/eslint.ts';
import type { EditorconfigOverride } from '#cli/generation/format.ts';
import { editorconfigOverrides, prettierConfig } from '#cli/generation/format.ts';
import { headerFor, headerLines, jsonHeaderAdded } from '#cli/generation/headers.ts';
import { scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';
import { aliasesFor, javascriptConfig } from '#cli/generation/javascript.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { markdownlintRules } from '#cli/generation/markdownlint.ts';
import { styleNames } from '#cli/generation/vale-styles.ts';
import { readAsset } from '#cli/platform/assets.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { MergedView } from '#cli/policy/merge.ts';
import type { Policy } from '#cli/policy/normalize.ts';
import type { ScopeSelection } from '#cli/policy/resolve.ts';
import { policyValue } from '#cli/policy/settings.ts';
import type { TrackedFile } from '#cli/repository/file-classification.ts';
import { Eta } from 'eta';
import { TomlDate, stringify as stringifyToml } from 'smol-toml';
import { stringify as stringifyYaml } from 'yaml';

const JSON_INDENT = 4;

const LEADING_NEWLINES = /^\n+/u;

const JSON_EXTENSIONS = new Set(['.json', '.webmanifest']);

export const eta = new Eta({ autoEscape: false, autoTrim: false, useWith: true, rmWhitespace: false, varName: 'it' });

function toolNames(scopes: ScopeSelection[]): string[] {
    const names = scopes.flatMap((entry) =>
        entry.selected.flatMap((manifest) => manifest.tools.map((tool) => tool.name)),
    );
    return [...new Set(names)].toSorted((a, b) => a.localeCompare(b));
}

// The npm packages of the selected tools: a repository installs them to run them, and imports none of them.
function toolPackages(scopes: ScopeSelection[]): string[] {
    const names = scopes.flatMap((entry) =>
        entry.selected.flatMap((manifest) =>
            manifest.tools.flatMap((tool) => {
                const name = tool.installers['npm']?.name;
                return name === undefined ? [] : [name];
            }),
        ),
    );
    return [...new Set(names)].toSorted((a, b) => a.localeCompare(b));
}

function knipEntries(policy: Policy, scope: string): string[] {
    const layers = [
        { path: '', table: policy },
        ...Object.entries(policy.scopeTables)
            .filter(([path]) => path === scope || scope.startsWith(`${path}/`))
            .map(([path, table]) => ({ path, table })),
    ];
    return layers.flatMap(({ path, table }) => {
        const entries = (policyValue(table, 'tools.knip.entry')?.value ?? []) as string[];
        return entries.map((pattern) => {
            if (path === '') return pattern;
            return pattern.startsWith('!') ? `!${path}/${pattern.slice(1)}` : `${path}/${pattern}`;
        });
    });
}

/**
 * The inputs every template sees.
 * @param root
 * @param policy
 * @param sourceFiles
 * @param scopes
 * @param version
 * @param selection the scope being rendered
 * @param fragments the fragment text other configurations contribute
 * @returns the template inputs
 */
export function templateInputs(
    root: string,
    policy: Policy,
    sourceFiles: TrackedFile[],
    scopes: ScopeSelection[],
    selection: ScopeSelection,
    version: string,
    fragments = '',
): TemplateInputs {
    const { view } = selection;
    const files = (extension: string): string[] =>
        sourceFiles
            .filter((file) => file.path.endsWith(extension) && file.nature === 'source')
            .map((file) => file.path);
    return {
        javascriptConfig: (targetPath) => javascriptConfig(root, policy, targetPath, selection.scope.path),
        prettierConfig: (targetPath) => prettierConfig(policy, targetPath, view.extra('prettier')),
        markdownlintRules: markdownlintRules(view),
        scopeIgnorePatterns,
        editorconfigOverrides: () => editorconfigOverrides(policy),
        eslintPolicy: [...structuralRuleBlocks(scopes), ...eslintRuleBlocks(policy)],
        isAll: policy.level === 'all',
        typescriptOptions: policy.level === 'all' ? ALL_COMPILER_OPTIONS : RECOMMENDED_COMPILER_OPTIONS,
        prose: {
            styles: styleNames(),
            blockIgnores: BLOCK_IGNORES,
            tokenIgnores: TOKEN_IGNORES,
        },
        version: version,
        scope: selection.scope.path,
        scopes: scopes
            .filter((entry) => entry.scope.path !== '')
            .map((entry) => ({
                path: entry.scope.path,
                configurations: entry.selected.map((manifest) => manifest.configuration.name),
            })),
        configurationScopes: (configuration) =>
            scopes
                .filter((entry) => entry.view.configurations.includes(configuration))
                .toSorted(
                    (left, right) =>
                        left.scope.path.split('/').length - right.scope.path.split('/').length ||
                        left.scope.path.localeCompare(right.scope.path),
                )
                .map((entry) => ({ path: entry.scope.path, settings: entry.view.settings })),
        configurations: view.configurations,
        policy: policy,
        view,
        format: view.format,
        settings: view.settings,
        fragments,
        tool: view.tool,
        entryFiles: (scope) => knipEntries(policy, scope),
        limit: view.limit,
        rulesOff: view.rulesOff,
        ignoresFor: view.ignoresFor,
        extra: view.extra,
        json: (value, indent = JSON_INDENT) =>
            JSON.stringify(value, null, indent)
                .replaceAll('\u{2028}', String.raw`\u2028`)
                .replaceAll('\u{2029}', String.raw`\u2029`),
        toml: stringifyToml,
        yaml: stringifyYaml,
        tomlDate: TomlDate,
        // Repository-wide output includes nested configurations. The configuration owner narrows per-scope output.
        has: (configuration) =>
            view.configurations.includes(configuration) ||
            (selection.scope.path === '' &&
                scopes.some((entry) =>
                    entry.selected.some((manifest) => manifest.configuration.name === configuration),
                )),
        importAliases: (scope) => aliasesFor(root, scope),
        tools: toolNames(scopes),
        toolPackages: toolPackages(scopes),
        files,
        header: headerFor('x.toml', version),
        headerLines: headerLines(version),
    };
}

/**
 * Renders a configuration template asset to the final text of a target, header included unless the target's reader refuses unknown keys.
 * @param templatePath the asset path of the template
 * @param targetPath the path the text is written to
 * @param inputs the template inputs
 * @param isHeaderWanted false for a reader that refuses the header key or comment
 * @returns the text to write
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

export type TemplateInputs = {
    markdownlintRules: Record<string, unknown>;
    targetPath?: string;
    scopeIgnorePatterns: (patterns: string[], scope: string) => string[];
    javascriptConfig: (targetPath: string) => Record<string, unknown>;
    prettierConfig: (targetPath: string) => Record<string, unknown>;
    editorconfigOverrides: () => EditorconfigOverride[];
    eslintPolicy: EslintRuleBlock[];
    isAll: boolean;
    typescriptOptions: Record<string, boolean>;
    prose: { blockIgnores: string[]; tokenIgnores: string[]; styles: string[] };
    version: string;
    scope: string;
    scopes: { path: string; configurations: string[] }[];
    configurationScopes: (configuration: string) => { path: string; settings: Record<string, unknown> }[];
    configurations: string[];
    policy: Policy;
    view: MergedView;
    format: MergedView['format'];
    settings: Record<string, unknown>;
    fragments: string;
    tool: (name: string) => Record<string, unknown>;
    entryFiles: (scope: string) => string[];
    limit: (key: string, language?: string) => number | undefined;
    rulesOff: (check: string) => string[];
    ignoresFor: MergedView['ignoresFor'];
    extra: (name: string) => Record<string, unknown> | undefined;
    json: (value: unknown, indent?: number) => string;
    toml: (value: Record<string, unknown>) => string;
    yaml: (value: Record<string, unknown>) => string;
    tomlDate: new (value: string) => Date;
    has: (configuration: string) => boolean;
    files: (extension: string) => string[];
    importAliases: (scope: string) => Record<string, string>;
    tools: string[];
    /** The npm package of every selected tool that has one. */
    toolPackages: string[];
    header: string;
    headerLines: string[];
};
