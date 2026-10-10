import { z } from 'zod';
import { Eta } from 'eta';
import { TomlDate } from 'smol-toml';
import { stringify as stringifyYaml } from 'yaml';
import { dirname, relative } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { extensionOf } from '#cli/platform/contracts.ts';
import { readAsset } from '#cli/platform/root/public.ts';
import { jsonText } from '#cli/generation/json-format.ts';
import { pythonInputs } from '#cli/generation/contracts.ts';
import { buildJsconfig } from '#cli/generation/jsconfig.ts';
import type { Manifest } from '#cli/types/configurations.ts';
import { TOOL_EMIT_FORMAT } from '#cli/config/parsers/toml.ts';
import { collectPins } from '#cli/configurations/contracts.ts';
import { byScopeDepth } from '#cli/repository/paths/public.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import { readSwiftVersion } from '#cli/parsers/swift/public.ts';
import { TEST_RULE_NAMES } from '#cli/config/generation/eslint.ts';
import { JSON_EXTENSIONS } from '#cli/config/generation/headers.ts';
import { stringify as stringifyToml } from '@decimalturn/toml-patch';
import { frozenMigrationPaths } from '#cli/parsers/sql/migrations.ts';
import { compileSettingValue } from '#cli/policy/schema/contracts.ts';
import { getProjectDependencies } from '#cli/repository/contracts.ts';
import { eslintInputs } from '#cli/generation/eslint/configuration.ts';
import { packageWorkspaces } from '#cli/repository/paths/contracts.ts';
import type { CompiledSetting } from '#cli/types/policy/setting-values.ts';
import { HTML_RULES, HTML_ALL_RULES } from '#cli/config/generation/html.ts';
import { stylelintRuleNamesSchema } from '#cli/parsers/schema/stylelint.ts';
import type { EtaInputs, ScopeEtaInputs } from '#cli/types/generation/eta.ts';
import { buildTsconfig, requiredTsconfigOptions } from '#cli/generation/tsconfig.ts';
import type { Policy, ScopeView, ScopeSelection } from '#cli/types/policy/settings.ts';
import { ETA_OPTIONS, JSON_INDENT, LEADING_NEWLINES } from '#cli/config/generation/eta.ts';
import { editorconfigOverrides, prettierConfiguration } from '#cli/generation/documents/public.ts';
import nativeStylelintRuleNames from '../../../configurations/language/css/rule-names.json' with { type: 'json' };

import {
    headerFor,
    pointerPaths,
    addJsonHeader,
    scopeIgnorePatterns,
    selectedIgnorePaths,
} from '#cli/generation/documents/contracts.ts';
import {
    POLICY_TABLE_NAMES,
    SETTING_VALUES_FILE,
    SETTING_SCHEMA_IMPORTS,
    SETTING_NAMESPACES_FILE,
    SETTING_NAMESPACE_IMPORTS,
} from '#cli/config/policy/setting-values.ts';
import {
    entryFiles,
    proseInputs,
    nativeSetting,
    compileNamespace,
    publicToolTables,
    requiredSettings,
    validateDefaults,
    effectiveNamespace,
} from '#cli/generation/compilation/contracts.ts';

const stylelintRuleNames = stylelintRuleNamesSchema.parse(nativeStylelintRuleNames).rules;

// Resolve target rules, then the selected level and the check's finding ignores.
function htmlRules(
    view: Pick<ScopeView, 'rulesOff'>,
    level: Policy['level'],
    check: string,
    overrides: Record<string, unknown> = {},
) {
    const rules: Record<string, unknown> = { ...HTML_RULES, ...overrides };
    const ignored = [...(level === 'all' ? [] : HTML_ALL_RULES), ...view.rulesOff(check)];
    for (const rule of ignored) rules[rule] = 'off';
    return rules;
}

function scopeInputs(input: ScopeEtaInputs) {
    const { session, selection, manifests, projects } = input;
    const { scopes, repository } = session;
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
        dirname,
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
        pointers: scopes.flatMap((selection) =>
            selection.selected.flatMap((manifest) =>
                manifest.toolFiles.flatMap((toolFile) =>
                    pointerPaths({ files: repository.files, selection, manifest, scopes }, toolFile),
                ),
            ),
        ),
        ignoredPaths: selectedIgnorePaths(scopes),
        policy,
        entryFiles: (scope: string) => entryFiles(policy, scopes, scope),
        testRuleNames: TEST_RULE_NAMES,
        stylelintRuleNames,
        toolBinaries: tools.filter((tool) => tool.kind !== 'library').map((tool) => tool.name),
        toolPackages: packages,
    };
}

function schemaModule(lines: string[]): string {
    return [`// Generated by the policy schema compiler.`, ...lines, ''].join('\n');
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
    const { options, ...view } = selection.view;
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
        ...view,
        ...scopeInputs({ session, selection, manifests, projects: session.packageManifests }),
        ...eslintInputs(session, selection),
        javascriptConfig: (target) =>
            buildJsconfig({
                ...compilerContext,
                declarationPaths: policy.declarations.flatMap((entry) => entry.paths),
                importStyles: options('tools.eslint')['import_extensions'],
                target,
            }),
        scopeIgnorePatterns,
        frozenMigrationPaths,
        swiftVersion: () => readSwiftVersion(compilerContext, options('swift').xcode_project),
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
        toml: (value) => stringifyToml(value, TOOL_EMIT_FORMAT),
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

/**
 * Emit literal validators whose inferred keys and values derive from the shipped declarations.
 * @param declarations the validated manifests and their native requirement graph
 * @returns the compiler-owned module text, without schema-injected policy defaults
 */
export function settingSchemaSources(declarations: Iterable<Manifest>): Map<string, string> {
    const manifests = [...declarations];
    const authored = manifests.flatMap((manifest) => manifest.settings);
    const entries = new Map<string, CompiledSetting>(
        authored.map((declaration) => {
            const native = nativeSetting(declaration.name);
            if (declaration.items === 'native' && !(native?.schema instanceof z.ZodArray))
                throw new Error(`The native list item declaration for ${declaration.name} has no owned array schema.`);
            return [declaration.name, native ?? compileSettingValue(declaration)];
        }),
    );
    const values: string[] = [];
    const namespaces = new Map<string, [string, CompiledSetting][]>();
    for (const [name, value] of [...entries].toSorted(([left], [right]) => left.localeCompare(right))) {
        const segments = name.split('.');
        const prefixLength = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
        const namespace = segments.splice(0, prefixLength).join('.');
        const children = namespaces.get(namespace) ?? [];
        children.push([segments.join('.'), value]);
        namespaces.set(namespace, children);
        const fields = segments.map((field) => `.shape[${JSON.stringify(field)}].unwrap()`).join('');
        values.push(`${JSON.stringify(name)}:settingNamespaceSchemas[${JSON.stringify(namespace)}]${fields}`);
    }
    const compiled = new Map([...namespaces].map(([name, children]) => [name, compileNamespace(children)]));
    validateDefaults(
        authored,
        z.strictObject(Object.fromEntries([...compiled].map(([name, value]) => [name, value.schema]))),
    );
    const namespaceSchemas = [...compiled].map(([name, value]) => `${JSON.stringify(name)}:${value.expression}`);
    const configurations = [...namespaces.keys()]
        .filter((name) => !name.includes('.') && !POLICY_TABLE_NAMES.includes(name))
        .map((name) => `${JSON.stringify(name)}:settingNamespaceSchemas[${JSON.stringify(name)}].optional()`);
    const activeSchemas = [...namespaces.keys()].map((name) => {
        const parent = `settingNamespaceSchemas[${JSON.stringify(name)}]`;
        return `${JSON.stringify(name)}:${effectiveNamespace(parent, requiredSettings(manifests, name))}`;
    });
    return new Map([
        [
            SETTING_NAMESPACES_FILE,
            schemaModule([
                ...SETTING_NAMESPACE_IMPORTS,
                `export const settingNamespaceSchemas = {${namespaceSchemas.join(',')}};`,
                `export const publicToolsSchema = z.strictObject({${publicToolTables(compiled).join(',')}});`,
                `export const configurationSettingSchemas = {${configurations.join(',')}};`,
            ]),
        ],
        [
            SETTING_VALUES_FILE,
            schemaModule([
                "import { z } from 'zod';",
                ...SETTING_SCHEMA_IMPORTS,
                `export const activeSettingNamespaceSchemas = {${activeSchemas.join(',')}};`,
                'export const activeSettingNamespacesSchema = z.strictObject(activeSettingNamespaceSchemas).partial();',
                `export const settingValueSchemas = {${values.join(',')}};`,
            ]),
        ],
    ]);
}
