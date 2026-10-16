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
 * Ordered command arguments replace intact; other lists append, per-rule tables merge, and scalars replace.
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
 * The root settings and every scope table, with their locations in the document.
 * @param settings the repository settings.
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
 * The root settings and applicable scope tables, ordered from outermost to innermost.
 * @param settings the repository settings.
 * @param scope the scope path, '' or undefined for the root alone.
 * @returns the tables with their scope paths and reported names.
 */
function listApplicableTables(settings: Settings, scope: string | undefined): WrittenScopeTable[] {
    return listSettingsTables(settings)
        .filter((entry) => entry.scope === undefined || isInScope(scope ?? '', entry.scope))
        .toSorted((left, right) => compareScopeDepth(left.scope ?? '', right.scope ?? ''));
}

/**
 * Matches a written key to the declaration it belongs to: per-language and per-category variants map back to their base declaration.
 *
 * @param known the known settings of the selection.
 * @param key the dotted key as written.
 * @returns the declaration with the language and category the key names, or undefined when nothing exposes it.
 */
function findDeclaration(known: KnownSettings, key: string): DeclarationMatch | undefined {
    const direct = known.declarations.get(key);
    if (direct) return { declaration: direct };
    const [table, language, ...rest] = key.split('.');
    if (table === undefined || language === undefined || !LANGUAGE_GROUP_TABLES.has(table)) return undefined;
    return findVariantDeclaration(known, key, table, language, rest);
}

/**
 * Reads the written value the settings hold for a dotted key, or undefined.
 * @param settings the root table or one scope table.
 * @param key the dotted key.
 * @returns the value with its reason, or undefined when the document does not contain the key.
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
 * @param match the setting's declaration and written selector.
 * @param key the written dotted key.
 * @returns candidate keys from the broadest declaration to the selected field.
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
 * Resolve one selected default against its language, scope, and site build folder.
 * @param known the declarations and defaults of the selected configurations.
 * @param match the declaration and its language, if specified.
 * @param scope the project whose shipped paths apply.
 * @param readValue the effective value reader for this caller's settings tables.
 * @returns the selected default with repository-relative paths, or undefined when absent.
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
 * Resolves one key: configuration default, root table, scope table. Lists append and deduplicate; scalars replace.
 *
 * @param known the known settings of the selection.
 * @param settings the loaded settings.
 * @param key the dotted key.
 * @param scope the scope path whose table applies last, if any.
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
 * The effective declared settings, language defaults and written variants, in key order.
 *
 * @param known the known settings of the selection.
 * @param settings the loaded settings.
 * @param scope the scope path whose table applies last, if any.
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
 * Read the owning table of a setting, including a tool's own table.
 * @param key the full setting name.
 * @returns its table name.
 */
function getSettingTable(key: string): string {
    const [table, tool] = key.split('.');
    if (table === 'tools' && tool !== undefined) return `${table}.${tool}`;
    return table as string;
}

/**
 * Read a written setting value from its reason envelope or plain form.
 * @param written the authored setting.
 * @returns the value that a settings mutation changes.
 */
function getWrittenValue(written: unknown): unknown {
    if (isRecord(written) && Object.hasOwn(written, 'value')) return written['value'];
    return written;
}

/**
 * Replace a written value while retaining its authored reason envelope.
 * @param written the original setting
 * @param value the changed setting value
 * @returns the replacement in the same written form
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
