// Render configuration assets with the effective settings and inputs of their scope.
import { Eta } from 'eta';
import { stringify as stringifyYaml } from 'yaml';
import { readAsset } from '#cli/platform/assets.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import type { Session } from '#cli/types/planning.ts';
import { collectPins } from '#cli/configurations/pins.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { buildJsconfig } from '#cli/generation/jsconfig.ts';
import { buildTsconfig } from '#cli/generation/tsconfig.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { packageWorkspaces } from '#cli/repository/scopes.ts';
import { TomlDate, stringify as stringifyToml } from 'smol-toml';
import { JSON_EXTENSIONS } from '#cli/config/generation/headers.ts';
import { headerFor, addJsonHeader } from '#cli/generation/headers.ts';
import { eslintInputs } from '#cli/generation/eslint/configuration.ts';
import { isInScope, byScopeDepth } from '#cli/repository/selectors.ts';
import { scopeIgnorePatterns } from '#cli/generation/ignore-patterns.ts';
import { styleRules, proseFormats } from '#cli/generation/vale-styles.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { requiredTsconfigOptions } from '#cli/policy/settings/typescript.ts';
import { readManifests, getProjectDependencies } from '#cli/repository/manifests.ts';
import { tablesFor, policyValue, harnessFolders } from '#cli/policy/settings/lookup.ts';
import { editorconfigOverrides, prettierConfiguration } from '#cli/generation/formatting.ts';
import type { TemplateInputs, ScopeTemplateInputs } from '#cli/types/generation/templates.ts';

import {
    ETA_OPTIONS,
    JSON_INDENT,
    BLOCK_IGNORES,
    TOKEN_IGNORES,
    LEADING_NEWLINES,
} from '#cli/config/generation/templates.ts';

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

function scopeInputs(input: ScopeTemplateInputs) {
    const { policy, scopes, selection, manifests, projects } = input;
    const { view } = selection;
    const tools = collectPins(manifests);
    const names = tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name);
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
        prettierConfig: (targetPath: string) => prettierConfiguration({ ...formatting, targetPath }),
        scope: selection.scope.path,
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
                    harness: harnessFolders(policy, entry.scope.path)[0],
                })),
        configurations: view.configurations,
        ruffRules: selection.selected.flatMap((manifest) => [
            ...manifest.ruff_rules.recommended,
            ...(policy.level === 'all' ? manifest.ruff_rules.all : []),
        ]),
        policy: policy,
        format: view.format,
        settings: view.settings,
        options: view.options,
        entryFiles: (scope: string) => entryFiles(policy, scopes, scope),
        limit: view.limit,
        rulesOff: view.rulesOff,
        ignoresFor: view.ignoresFor,
        verbatim: view.verbatim,
        toolBinaries: names,
        toolPackages: packages,
    };
}

/** Shared template compilation preserves identical options for targets and fragments. */
export const eta = new Eta(ETA_OPTIONS);

/**
 * The inputs every template sees.
 * @param session the repository, policy, scope selections, and release version.
 * @param selection the scope being rendered.
 * @param manifests the applicable configuration manifests with only their required tools.
 * @returns the template inputs, with empty fragment parts the generator fills per target.
 */
export function templateInputs(session: Session, selection: ScopeSelection, manifests: Manifest[]): TemplateInputs {
    const { root, scopes, version } = session;
    const { policy } = session.policyFiles;
    const sourceFiles = session.repository.files;
    const { view } = selection;
    const files = (extension: string): string[] =>
        sourceFiles.filter((file) => file.path.endsWith(extension) && file.kind === 'source').map((file) => file.path);
    return {
        ...scopeInputs({ policy, scopes, selection, manifests, projects: readManifests(root, sourceFiles) }),
        ...eslintInputs(session, selection),
        javascriptConfig: (target) =>
            buildJsconfig({
                root,
                declarationPaths: policy.declarations.flatMap((entry) => entry.paths),
                files: sourceFiles,
                scopeEntries: scopes.map((entry) => entry.scope),
                importStyles: view.options('tools.eslint')['import_extensions'] as Record<string, string>,
                target,
                scope: selection.scope.path,
            }),
        scopeIgnorePatterns,
        editorconfigOverrides: () => editorconfigOverrides(policy),
        isAll: policy.level === 'all',
        typescriptConfig: (target) =>
            buildTsconfig({
                root,
                target,
                scope: selection.scope.path,
                files: sourceFiles,
                scopeEntries: scopes.map((entry) => entry.scope),
                options: Object.fromEntries(
                    Object.entries(requiredTsconfigOptions(policy.level, view.configurations)).filter(
                        ([option]) => !view.rulesOff('typescript/tsconfig').includes(option),
                    ),
                ),
            }),
        prose: {
            rules: styleRules(),
            blockIgnores: BLOCK_IGNORES,
            tokenIgnores: TOKEN_IGNORES,
            formats: proseFormats(),
        },
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
        files,
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
    isHeaderWanted: boolean,
): string {
    const rendered = eta.renderString(readAsset(templatePath), { ...inputs, targetPath });
    if (JSON_EXTENSIONS.has(extensionOf(targetPath))) {
        const format = { width: inputs.format.print_width, indent: inputs.format.indent_width };
        if (!isHeaderWanted) return jsonText(JSON.parse(rendered), format);
        return addJsonHeader(rendered, inputs.version, format);
    }
    const body = rendered.replace(LEADING_NEWLINES, '').trimEnd() + '\n';
    if (!isHeaderWanted) return body;
    return `${headerFor(targetPath, inputs.version)}${body}`;
}
