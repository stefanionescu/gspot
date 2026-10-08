import { z } from 'zod';
import { basename } from 'node:path/posix';
import type { Session } from '#cli/types/planning.ts';
import { VALE_PACKAGES } from '#cli/config/tools/vale.ts';
import { toolsSchema } from '#cli/policy/schema/tools.ts';
import { namingLists } from '#cli/parsers/schema/naming.ts';
import type { EtaInputs } from '#cli/types/generation/eta.ts';
import { TOOL_KEY_DEPTH } from '#cli/config/policy/settings.ts';
import { allowlistSchema } from '#cli/parsers/schema/licenses.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import { SETTING_DEFAULT_FIELDS } from '#cli/config/configurations.ts';
import { isInScope, byScopeDepth } from '#cli/repository/paths/public.ts';
import type { CompiledSetting } from '#cli/types/policy/setting-values.ts';
import { tablesFor, policyValue } from '#cli/policy/settings/contracts.ts';
import type { Policy, ScopeSelection } from '#cli/types/policy/settings.ts';
import { BLOCK_IGNORES, TOKEN_IGNORES } from '#cli/config/generation/eta.ts';
import type { Manifest, SettingDeclaration } from '#cli/types/configurations.ts';
import { PROSE_GRAMMARS, BANNED_HEADINGS } from '#cli/config/generation/prose.ts';
import { formatSchema, architectureRolesSchema, environmentReadersSchema } from '#cli/policy/schema/contracts.ts';

function prefixed(path: string, pattern: string): string {
    if (path === '') return pattern;
    return pattern.startsWith('!') ? `!${path}/${pattern.slice(1)}` : `${path}/${pattern}`;
}

function unwrapSetting(value: CompiledSetting): CompiledSetting {
    let { schema, expression } = value;
    while (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
        schema = z.instanceof(z.ZodType).parse(schema.unwrap());
        expression += '.unwrap()';
    }
    return { schema, expression };
}

function childSetting(parent: CompiledSetting, keys: string[]): CompiledSetting | undefined {
    let value = parent;
    for (const key of keys) {
        const { schema, expression } = unwrapSetting(value);
        if (!(schema instanceof z.ZodObject) || !Object.hasOwn(schema.shape, key)) return undefined;
        value = {
            schema: z.instanceof(z.ZodType).parse(schema.shape[key]),
            expression: `${expression}.shape[${JSON.stringify(key)}]`,
        };
    }
    return unwrapSetting(value);
}

function settingChildren<Value>(entries: [string, Value][]) {
    const leaves = new Map<string, Value>();
    const tables = new Map<string, [string, Value][]>();
    for (const [name, value] of entries) {
        const [key, ...remaining] = name.split('.');
        if (key === undefined) throw new Error('A setting must have a name.');
        if (remaining.length === 0) {
            leaves.set(key, value);
            continue;
        }
        const children = tables.get(key) ?? [];
        children.push([remaining.join('.'), value]);
        tables.set(key, children);
    }
    return { leaves, tables };
}

/**
 * Compute the selected prose packages, vocabulary, and native formats.
 * @param session the effective repository session
 * @param manifests the selected manifests
 * @returns prose asset inputs
 */
export function proseInputs(session: Session, manifests: Manifest[]): EtaInputs['prose'] {
    const words = Object.keys(session.policyFiles.policy.words);
    return {
        packages: VALE_PACKAGES,
        bannedHeadings: BANNED_HEADINGS,
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

// The entry files of a folder: what the policy declares for it, then what the configurations of the deepest scope around it know.
/**
 * Select authored and declared entry files for their effective scope.
 * @param policy the authored policy
 * @param scopes the effective selections
 * @param scope the owning path
 * @returns scoped entry patterns
 */
export function entryFiles(policy: Policy, scopes: ScopeSelection[], scope: string): string[] {
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

/**
 * Find the authoritative native schema and source expression for a setting.
 * @param name the declared setting path
 * @returns the owned compiled setting, when declared natively
 */
export function nativeSetting(name: string): CompiledSetting | undefined {
    const [namespace, ...keys] = name.split('.');
    const owners = new Map<string, CompiledSetting>([
        ['tools', { schema: toolsSchema, expression: 'toolsSchema' }],
        ['licenses', { schema: allowlistSchema, expression: 'allowlistSchema' }],
        ['naming', { schema: namingLists, expression: 'namingLists' }],
        ['format', { schema: formatSchema, expression: 'formatSchema' }],
        [
            'secrets',
            {
                schema: z.strictObject({ reader_functions: environmentReadersSchema }),
                expression: 'z.strictObject({reader_functions: environmentReadersSchema})',
            },
        ],
        [
            'architecture',
            {
                schema: z.strictObject({ roles: architectureRolesSchema }),
                expression: 'z.strictObject({roles: architectureRolesSchema})',
            },
        ],
    ]);
    const value = owners.get(namespace ?? '');
    if (value === undefined) return undefined;
    return childSetting(value, keys);
}

/**
 * Compile dotted setting declarations into their native strict table.
 * @param entries the compiled setting leaves
 * @returns the strict schema and its source expression
 */
export function compileNamespace(entries: [string, CompiledSetting][]): CompiledSetting<z.ZodObject> {
    const { leaves, tables } = settingChildren(entries);
    for (const [name, children] of tables) {
        const base = leaves.get(name);
        const nested = compileNamespace(children);
        leaves.set(
            name,
            base === undefined
                ? nested
                : {
                      schema: z.instanceof(z.ZodObject).parse(base.schema).extend(nested.schema.shape),
                      expression: `${base.expression}.extend(${nested.expression}.shape)`,
                  },
        );
    }
    const fields = [...leaves].map(([name, value]) => `${JSON.stringify(name)}:${value.expression}.optional()`);
    return {
        schema: z.strictObject(Object.fromEntries([...leaves].map(([name, value]) => [name, value.schema.optional()]))),
        expression: 'z.strictObject({' + fields.join(',') + '})',
    };
}

/**
 * Validate authored manifest defaults against their compiled native schema.
 * @param declarations the authored setting declarations
 * @param schema the compiled namespaces
 */
export function validateDefaults(declarations: SettingDeclaration[], schema: z.ZodObject): void {
    const defaults = declarations.flatMap((declaration) =>
        Object.entries(declaration)
            .filter(([key, value]) => SETTING_DEFAULT_FIELDS.has(key) && value !== undefined)
            .map(([key, value]) => ({ declaration, key, value })),
    );
    for (const { declaration, key, value: authored } of defaults) {
        const segments = declaration.name.split('.');
        const prefixLength = segments[0] === 'tools' ? TOOL_KEY_DEPTH : 1;
        const value = childSetting({ schema, expression: '' }, [
            segments.slice(0, prefixLength).join('.'),
            ...segments.slice(prefixLength),
        ]);
        if (value === undefined) throw new Error(`No compiled validator owns ${declaration.name}.`);
        const parsed = value.schema.safeParse(authored);
        if (!parsed.success)
            throw new Error(
                parsed.error.issues
                    .map((issue) => `${declaration.name}.${key}.${issue.path.map(String).join('.')}: ${issue.message}`)
                    .join('\n'),
            );
    }
}

/**
 * Emit required effective fields for a compiled namespace.
 * @param expression the native namespace expression
 * @param required the setting paths required by the selected declarations
 * @returns the effective schema expression
 */
export function effectiveNamespace(expression: string, required: string[]): string {
    const { leaves, tables: children } = settingChildren(required.map((name) => [name, true]));
    const fields = [...children].map(([key, names]) => {
        const parent = `${expression}.shape[${JSON.stringify(key)}].unwrap()`;
        return `${JSON.stringify(key)}:${effectiveNamespace(
            parent,
            names.map(([name]) => name),
        )}`;
    });
    const requiredFields = [...leaves.keys()].map((name) => `${JSON.stringify(name)}:true`);
    return (
        expression +
        (requiredFields.length === 0 ? '' : `.required({${requiredFields.join(',')}})`) +
        (fields.length === 0 ? '' : `.extend({${fields.join(',')}})`)
    );
}

/**
 * Find defaults guaranteed by every provider of a namespace.
 * @param manifests the validated configuration manifests
 * @param namespace the setting namespace
 * @returns the guaranteed setting paths
 */
export function requiredSettings(manifests: Manifest[], namespace: string): string[] {
    const available = new Map(manifests.map((manifest) => [manifest.configuration.name, manifest]));
    const prefix = `${namespace}.`;
    const providers = manifests.filter((manifest) =>
        manifest.settings.some((setting) => setting.name.startsWith(prefix)),
    );
    const defaults = providers.map(
        (provider) =>
            new Set(
                selectForScope(
                    { configurations: [provider.configuration.name], removed_configurations: [], scope: {} },
                    '',
                    available,
                ).flatMap((manifest) =>
                    manifest.settings.filter((setting) => setting.default !== undefined).map((setting) => setting.name),
                ),
            ),
    );
    return [...(defaults[0] ?? [])]
        .filter((name) => name.startsWith(prefix) && defaults.every((keys) => keys.has(name)))
        .map((name) => name.slice(prefix.length));
}

/**
 * Emit strict tool tables from the native and compiled declarations.
 * @param compiled the compiled setting namespaces
 * @returns the public tool schema field expressions
 */
export function publicToolTables(compiled: Map<string, CompiledSetting<z.ZodObject>>): string[] {
    const namespaces = [...compiled.keys()];
    const tools = [
        ...new Set([
            ...Object.keys(toolsSchema.shape),
            ...namespaces.filter((name) => name.startsWith('tools.')).map((name) => name.slice('tools.'.length)),
        ]),
    ].toSorted((left, right) => left.localeCompare(right));
    return tools.map((tool) => {
        const native = childSetting({ schema: toolsSchema, expression: 'toolsSchema' }, [tool]);
        const key = `tools.${tool}`;
        const namespace = `settingNamespaceSchemas[${JSON.stringify(key)}]`;
        if (native === undefined) return `${JSON.stringify(tool)}:${namespace}.optional()`;
        const table = z.instanceof(z.ZodObject).parse(native.schema);
        const namespaceSchema = compiled.get(key);
        const additions =
            namespaceSchema !== undefined &&
            Object.keys(namespaceSchema.schema.shape).some((field) => !Object.hasOwn(table.shape, field));
        const field = additions
            ? `${native.expression}.extend(${namespace}.shape).optional()`
            : `toolsSchema.shape[${JSON.stringify(tool)}]`;
        return `${JSON.stringify(tool)}:${field}`;
    });
}
