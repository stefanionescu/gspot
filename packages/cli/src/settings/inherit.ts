import { z } from 'zod';
import { joinDefaultPaths } from '#cli/settings/paths.ts';
import { SETTINGS_FILE } from '#cli/config/system/locations.ts';
import { commandSchema } from '#cli/configurations/schema/parts.ts';
import { unwrapSettingSchema } from '#cli/settings/schema/parts.ts';
import { findSettingSchema } from '#cli/settings/schema/gspot-toml.ts';
import type { SettingDeclaration } from '#cli/types/settings/tables.ts';
import { isInScope, compareScopeDepth } from '#cli/repository/scopes.ts';
import { isRecord, getValueAt, stripUndefined } from '#cli/system/values.ts';
import { ALL_LANGUAGES, CATEGORY_KEY_PARTS, LANGUAGE_GROUP_TABLES } from '#cli/config/settings/values.ts';

import type {
    Settings,
    SettingState,
    KnownSettings,
    SettingDefault,
    WrittenSetting,
    EffectiveSetting,
    DeclarationMatch,
    WrittenScopeTable,
} from '#cli/types/settings/values.ts';

function findLanguageDeclaration(
    known: KnownSettings,
    key: string,
    table: string,
    language: string,
    name: string,
): DeclarationMatch | undefined {
    const base = known.declarations.get(`${table}.${name}`);
    const languages = base?.languages ?? [];
    if (base && (languages.includes(language) || languages.includes(ALL_LANGUAGES)))
        return { declaration: base, language };
    const grouped = known.declarations.get(key);
    return grouped ? { declaration: grouped } : undefined;
}

function findVariantDeclaration(
    known: KnownSettings,
    key: string,
    table: string,
    language: string,
    rest: string[],
): DeclarationMatch | undefined {
    const [first, second] = rest;
    if (first === undefined) return undefined;
    if (second === undefined) return findLanguageDeclaration(known, key, table, language, first);
    if (table !== 'naming' || rest.length !== CATEGORY_KEY_PARTS) return undefined;
    return findCategoryDeclaration(known, language, first, second);
}

function findCategoryDeclaration(
    known: KnownSettings,
    language: string,
    category: string,
    name: string,
): DeclarationMatch | undefined {
    const base = known.declarations.get(`naming.${language}.${name}`) ?? known.declarations.get(`naming.${name}`);
    if (!base) return undefined;
    const isCovered = (base.languages ?? []).includes(language) && (base.categories ?? []).includes(category);
    return isCovered ? { declaration: base, language, category } : undefined;
}

function mergeTable(
    declaration: SettingDeclaration,
    key: string,
    current: SettingState,
    table: WrittenScopeTable,
    candidates: string[],
): SettingState {
    let result = current;
    const written = candidates
        .map((candidate) => ({ candidate, found: getWrittenSetting(table.table, candidate) }))
        .filter(
            (entry): entry is typeof entry & { found: NonNullable<typeof entry.found> } => entry.found !== undefined,
        );
    for (const { candidate, found } of written) {
        const owner = table.scope === undefined ? SETTINGS_FILE : `[scope ${JSON.stringify(table.scope)}]`;
        result = {
            value: mergeValue(declaration, result.value, getValueAt(table.table, candidate.split('.'))),
            source: candidate === key ? owner : `${owner} (${candidate})`,
            origin: table.scope === undefined ? 'root' : 'scope',
            ...stripUndefined({ originScope: table.scope }),
            reason: found.reason,
        };
    }
    return result;
}

/**
 * Merge two values: command arguments replace whole, other lists append, per-rule tables merge, and single values replace.
 * @param declaration the setting.
 * @param current the value so far.
 * @param found the value the next table writes.
 * @returns the merged value.
 */
function mergeValue(declaration: SettingDeclaration, current: unknown, found: unknown): unknown {
    let schema = findSettingSchema(declaration.name);
    if (schema !== undefined) schema = unwrapSettingSchema(schema);
    if (schema instanceof z.ZodUnion)
        schema = schema.options.find((option) => option instanceof z.ZodArray || option === commandSchema) as
            | z.ZodType
            | undefined;
    if (
        schema instanceof z.ZodArray &&
        schema !== commandSchema &&
        !(schema.element instanceof z.ZodObject) &&
        [current, found].every((value) => Array.isArray(value))
    )
        return [...new Set([current, found].flat())];
    if (declaration.type === 'table')
        return Object.fromEntries([current, found].filter(isRecord).flatMap((table) => Object.entries(table)));
    return found;
}

/**
 * List the root settings and every scope table, with their locations in the document.
 * @param settings the parsed gspot.toml.
 * @returns the tables in written order, root first.
 */
function listSettingsTables(settings: Settings): WrittenScopeTable[] {
    return [
        { table: settings, path: [] },
        ...Object.entries(settings.scopes).map(
            ([scope, table], index) => ({ table, scope, path: ['scope', index] }) satisfies WrittenScopeTable,
        ),
    ];
}

/**
 * List the root settings and the scope tables that apply, from outermost to innermost.
 * @param settings the parsed gspot.toml.
 * @param scope the folder, '' or undefined for the root alone.
 * @returns the tables with their scope paths and reported names.
 */
function listApplicableTables(settings: Settings, scope: string | undefined): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((entry) => entry.scope === undefined || isInScope(scope ?? '', entry.scope))
        .toSorted((left, right) => compareScopeDepth(left.scope ?? '', right.scope ?? ''));
}

/**
 * Match a written key to its declaration. Per-language and per-category keys map back to their base declaration.
 *
 * @param known the declarations and defaults of the selection.
 * @param key the dotted name as written.
 * @returns the match with its language and category, or undefined.
 */
function findDeclaration(known: KnownSettings, key: string): DeclarationMatch | undefined {
    const direct = known.declarations.get(key);
    if (direct) return { declaration: direct };
    const [table, language, ...rest] = key.split('.');
    if (table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)) return undefined;
    return findVariantDeclaration(known, key, table, language, rest);
}

/**
 * Read the written value of a dotted key.
 * @param settings the root table or one scope.
 * @param key the dotted setting name.
 * @returns the value with its reason, or undefined when the key has no value.
 */
function getWrittenSetting(settings: Pick<Settings, 'written'>, key: string): WrittenSetting | undefined {
    const value: unknown = getValueAt(settings.written, key.split('.'));
    if (value === undefined) return undefined;
    return isRecord(value) && Object.hasOwn(value, 'value')
        ? stripUndefined({
              value: value['value'],
              reason: typeof value['reason'] === 'string' ? value['reason'] : undefined,
          })
        : { value };
}

/**
 * Resolve a written language or category key after its broader declaration.
 * @param match the declaration and the written selector.
 * @param key the dotted name as written.
 * @returns candidate keys from the broadest declaration to the named field.
 */
function listCandidateKeys(match: DeclarationMatch, key: string): string[] {
    return match.language === undefined
        ? [key]
        : [
              match.declaration.name,
              ...(match.category === undefined
                  ? []
                  : [`naming.${match.language}.${key.slice(key.lastIndexOf('.') + 1)}`]),
              key,
          ];
}

/**
 * Resolve one default against its language, scope, and site build folder.
 * @param known the declarations and defaults of the configurations in use.
 * @param match the declaration and its language, if any.
 * @param scope the project whose shipped paths apply.
 * @param readValue reads a value from the settings tables of the caller.
 * @returns the default with repository-relative paths, or undefined.
 */
function findSettingDefault(
    known: KnownSettings,
    match: DeclarationMatch,
    scope: string,
    readValue: (key: string) => unknown,
): SettingDefault | undefined {
    const { declaration } = match;
    const table = declaration.name.slice(0, declaration.name.indexOf('.'));
    const field = declaration.name.slice(declaration.name.lastIndexOf('.') + 1);
    const languageKey = match.language === undefined ? undefined : `${table}.${match.language}.${field}`;
    const shipped =
        (languageKey === undefined ? undefined : known.defaults.get(languageKey)) ??
        known.defaults.get(declaration.name);
    if (shipped === undefined) return undefined;
    const folder = declaration.path_role === 'build' ? (readValue('site.build_folder') as string) : scope;
    return { ...shipped, value: joinDefaultPaths(declaration.name, shipped.value, folder) };
}

/**
 * Resolve one key: configuration default, root table, then scope table. Lists append without repeats; single values replace.
 *
 * @param known the declarations and defaults of the selection.
 * @param settings the parsed gspot.toml.
 * @param key the dotted setting name.
 * @param scope the folder whose table applies last, if any.
 * @returns the value with where it came from, or undefined when nothing exposes the key.
 */
function getSettingValue(
    known: KnownSettings,
    settings: Settings,
    key: string,
    scope?: string,
): EffectiveSetting | undefined {
    const match = findDeclaration(known, key);
    if (!match) return undefined;
    const { declaration } = match;
    const shipped = findSettingDefault(
        known,
        match,
        scope ?? '',
        (dependentKey) => (getSettingValue(known, settings, dependentKey, scope) as EffectiveSetting).value,
    );
    const tables = listApplicableTables(settings, scope);
    let initialSource = 'unset';
    if (shipped !== undefined)
        initialSource =
            shipped.configuration === 'gspot default' ? 'gspot default' : `configuration ${shipped.configuration}`;
    const start: SettingState = {
        value: shipped?.value,
        source: initialSource,
        origin: shipped ? 'configuration' : 'unset',
        reason: undefined,
    };
    const candidates = listCandidateKeys(match, key);
    let current = start;
    for (const table of tables) current = mergeTable(declaration, key, current, table, candidates);
    const { value, source, reason, origin, originScope } = current;
    return {
        key,
        declaration,
        value,
        source,
        origin,
        ...stripUndefined({ reason, scope, originScope }),
    };
}

/**
 * List the settings that apply, with language defaults and written variants, in key order.
 *
 * @param known the declarations and defaults of the selection.
 * @param settings the parsed gspot.toml.
 * @param scope the folder whose table applies last, if any.
 * @returns the resolved settings in key order.
 */
function listSettings(known: KnownSettings, settings: Settings, scope?: string): EffectiveSetting[] {
    function listWrittenKeys(table: unknown, path: string[]): string[] {
        const key = path.join('.');
        if (findDeclaration(known, key) !== undefined) return [key];
        return isRecord(table)
            ? Object.entries(table).flatMap(([name, value]) => listWrittenKeys(value, [...path, name]))
            : [];
    }
    const keys = [
        ...new Set([
            ...known.declarations.keys(),
            ...known.defaults.keys(),
            ...listApplicableTables(settings, scope).flatMap(({ table }) => listWrittenKeys(table.written, [])),
        ]),
    ].toSorted((a, b) => a.localeCompare(b));
    return keys.map((key) => getSettingValue(known, settings, key, scope)).filter((row) => row !== undefined);
}

/**
 * Read the table of a setting or of a tool.
 * @param key the full setting name.
 * @returns its table name.
 */
function getSettingTable(key: string): string {
    const [table, tool] = key.split('.');
    if (table === 'tools' && tool !== undefined) return `${table}.${tool}`;
    return table as string;
}

/**
 * Read a written setting value from its reasoned value or its plain value.
 * @param written the authored setting.
 * @returns the value that a settings edit changes.
 */
function getWrittenValue(written: unknown): unknown {
    if (isRecord(written) && Object.hasOwn(written, 'value')) return written['value'];
    return written;
}

/**
 * Replace a written value, and keep the reason of its reasoned value.
 * @param written the original setting.
 * @param value the new setting.
 * @returns the replacement in the same written form.
 */
function replaceWrittenValue(written: unknown, value: unknown): unknown {
    if (isRecord(written) && Object.hasOwn(written, 'value')) return { ...written, value };
    return value;
}
export {
    mergeValue,
    listSettings,
    getSettingValue,
    getWrittenValue,
    findDeclaration,
    getSettingTable,
    getWrittenSetting,
    listCandidateKeys,
    listSettingsTables,
    findSettingDefault,
    replaceWrittenValue,
    listApplicableTables,
};
