import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { LEADING_COMMENTS, LOCAL_RECORDS, UNREAD_SETTING_NOTE } from '#cli/config/generation/setup.ts';
import { LEFT_OUT_NOTES } from '#cli/config/settings/schema.ts';
import { SETTINGS_PREFACE_LINES } from '#cli/config/settings/validation.ts';
import { stripDefaults } from '#cli/generation/setup/defaults.ts';
import { readScopeFormat } from '#cli/generation/setup/format.ts';
import { listAlwaysSelected, listUnknownConfigurations, selectConfigurations } from '#cli/manifests/select.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import { parseTomlSyntax } from '#cli/parsers/formats/toml/syntax.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { buildAvailableSettings } from '#cli/settings/available.ts';
import { buildDetectedTables } from '#cli/settings/detected.ts';
import { overlayTable, removeUnknownKeys, setKey } from '#cli/settings/edit.ts';
import { findSettingSchema, unwrapSchemaPipes } from '#cli/settings/lookup.ts';
import { buildSettingsFromTable } from '#cli/settings/parse.ts';
import { selectConfigurationsForScope } from '#cli/settings/scopes.ts';
import { buildSettingsText } from '#cli/settings/text.ts';
import { formatSettingsErrors } from '#cli/settings/validation/messages.ts';
import { formatSettingsIssue } from '#cli/settings/validation/schema.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type { InitOptions, LeftOutSetting, SettingsDraft, Template } from '#cli/types/generation.ts';
import type { ProposedConfigurations, Repository } from '#cli/types/repository.ts';
import type { TomlTable } from '#cli/types/settings.ts';

function buildSettingsTable(draft: SettingsDraft, repository: Repository): TomlTable {
    const selected = {
        configurations: draft.configurations,
        removed_configurations: [],
        scopes: new Map(draft.scopes.map((scope) => [scope.path, { ...scope, removed_configurations: [] }])),
    };
    const scopes = ['', ...draft.scopes.map((each) => each.path)];
    const scopeConfigurations = scopes.map((scopePath) => ({
        scopePath,
        selected: selectConfigurationsForScope(selected, scopePath),
    }));
    const detected = buildDetectedTables(scopeConfigurations, { repository, scopes: draft.scopes });
    const tables = new Map(
        scopeConfigurations.map((selection) => [
            selection.scopePath,
            { ...detected.get(selection.scopePath), ...readScopeFormat(selection, draft, repository) },
        ]),
    );
    const scope = draft.scopes.map(({ path, configurations }) => ({ path, configurations, ...tables.get(path) }));
    return overlayTable(draft.template === undefined ? {} : structuredClone(draft.template.table), {
        ...(draft.level !== undefined && { level: draft.level }),
        configurations: draft.configurations,
        ...tables.get(''),
        ...draft.carried,
        ...(scope.length > 0 && { scope }),
    });
}

function leaveOutUnreadSettings(template: Template, configurations: ProposedConfigurations): Template {
    const offered = buildAvailableSettings(
        selectConfigurations([
            ...configurations.rootNames,
            ...configurations.scopeConfigurations.values().toArray().flat(),
            ...listAlwaysSelected(),
        ]),
        'basic',
    );
    const table = structuredClone(template.table);
    const written = buildSettingsFromTable(table);
    const unread = removeUnknownKeys(table, written, offered);
    return {
        ...template,
        table,
        leftOut: [...template.leftOut, ...unread.map((key) => ({ key, note: UNREAD_SETTING_NOTE }))],
    };
}

function listSettingValues(table: TomlTable, prefix: string): Array<{ key: string; value: unknown }> {
    return Object.entries(table).flatMap(([name, value]) => {
        const key = prefix === '' ? name : `${prefix}.${name}`;
        const schema = findSettingSchema(key);
        const isSettingsTable =
            schema !== undefined &&
            unwrapSchemaPipes(schema) instanceof z.ZodObject &&
            schema.meta()?.reasoned !== true;
        return isTable(value) && isSettingsTable ? listSettingValues(value, key) : [{ key, value }];
    });
}

function hasPathRole(node: unknown): boolean {
    if (Array.isArray(node)) return node.some((value) => hasPathRole(value));
    return (
        isTable(node) && (Object.hasOwn(node, 'path_role') || Object.values(node).some((value) => hasPathRole(value)))
    );
}

function findIgnoreNote(ignore: TomlTable, commandChecks: Set<unknown>): string | undefined {
    if (ignore['paths'] !== undefined) return LEFT_OUT_NOTES.paths;
    return commandChecks.has(ignore['check']) ? LEFT_OUT_NOTES.check : undefined;
}

function splitIgnores(
    records: TomlTable[],
    commandChecks: Set<unknown>,
): { kept: TomlTable[]; leftOut: LeftOutSetting[] } {
    const leftOut: LeftOutSetting[] = [];
    const kept = records.filter((record) => {
        const note = findIgnoreNote(record, commandChecks);
        if (note === undefined) return true;
        const key = ['[[ignore]]', record['check'], record['rule']]
            .filter((segment) => segment !== undefined)
            .map(String)
            .join(' ');
        leftOut.push({ key, note });
        return false;
    });
    return { kept, leftOut };
}

function findSettingNote(key: string): string | undefined {
    const schema = findSettingSchema(key);
    const local = schema?.meta()?.leftOut;
    if (local !== undefined) return LEFT_OUT_NOTES[local];
    if (schema === undefined) return undefined;
    return hasPathRole(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }))
        ? LEFT_OUT_NOTES.paths
        : undefined;
}

function splitSettings(settings: TomlTable): { table: TomlTable; leftOut: LeftOutSetting[] } {
    const table: TomlTable = {};
    const leftOut: LeftOutSetting[] = [];
    for (const { key, value } of listSettingValues(settings, '')) {
        const note = findSettingNote(key);
        if (note === undefined) setKey(table, key, value);
        else leftOut.push({ key, note });
    }
    return { table, leftOut };
}

function listLocalRecords(written: TomlTable): LeftOutSetting[] {
    return Object.entries(LOCAL_RECORDS).flatMap(([name, label]) => {
        const note = name === 'command_check' ? LEFT_OUT_NOTES.code : LEFT_OUT_NOTES.paths;
        const records = (written[name] ?? []) as TomlTable[];
        return records.map((record) => ({ key: `[[${name}]] ${String(record[label])}`, note }));
    });
}

function splitTemplate(written: TomlTable): { table: TomlTable; leftOut: LeftOutSetting[] } {
    const commandChecks = new Set(((written['command_check'] ?? []) as TomlTable[]).map((record) => record['id']));
    const ignores = splitIgnores((written['ignore'] ?? []) as TomlTable[], commandChecks);
    const copied = splitSettings(
        Object.fromEntries(
            Object.entries(written).filter(([name]) => name !== 'ignore' && !Object.hasOwn(LOCAL_RECORDS, name)),
        ),
    );
    if (ignores.kept.length > 0) copied.table['ignore'] = ignores.kept;
    return {
        table: copied.table,
        leftOut: [...listLocalRecords(written), ...ignores.leftOut, ...copied.leftOut],
    };
}

function readTemplateBytes(file: string, cwd: string): Buffer {
    const path = resolve(cwd, file);
    try {
        const stat = statSync(path);
        if (stat.isDirectory()) throw new GspotError('arguments', `--from needs a file, and ${file} is a folder.`);
        return readFileSync(path);
    } catch (error) {
        if (hasErrorCode(error, 'ENOENT')) throw new GspotError('arguments', `There is no file at ${file}.`);
        throw error;
    }
}

export function buildInitSettings(draft: SettingsDraft, repository: Repository): string {
    const document = buildSettingsTable(draft, repository);
    delete document['ci'];
    return `${SETTINGS_PREFACE_LINES.join('\n')}\n${buildSettingsText(draft.base, stripDefaults(document))}`;
}

export function buildSettingsDraft(
    configurations: ProposedConfigurations,
    options: Pick<InitOptions, 'level' | 'template'>,
    { prettierScripts, trackedPaths }: Pick<SettingsDraft, 'prettierScripts' | 'trackedPaths'>,
): SettingsDraft {
    const scopes = configurations.scopes.filter((scope) => scope.path !== '');
    const template =
        options.template === undefined ? undefined : leaveOutUnreadSettings(options.template, configurations);
    return {
        base: template?.text.replace(LEADING_COMMENTS, '') ?? '',
        configurations: configurations.rootNames,
        scopes: scopes.map((scope) => ({
            ...scope,
            configurations: configurations.scopeConfigurations.get(scope.path) ?? [],
        })),
        level: options.level,
        template,
        prettierScripts,
        trackedPaths,
    };
}

export function readTemplate(file: string, cwd: string): Template {
    const text = decodeUtf8(readTemplateBytes(file, cwd));
    if (text === undefined) throw new GspotError('settings', `${file} must contain valid UTF-8 text.`);
    const written = parseTomlFile(file, text);
    const result = settingsSchema.safeParse(written);
    const syntax = parseTomlSyntax(text, written);
    const errors = result.success
        ? listUnknownConfigurations(
              result.data.configurations.map((name, index) => ({ name, path: ['configurations', index] })),
          )
        : result.error.issues.flatMap((issue) => formatSettingsIssue(issue, syntax));
    if (!result.success || errors.length > 0)
        throw new GspotError('settings', formatSettingsErrors(errors, syntax, file));
    return {
        file,
        text,
        configurations: result.data.configurations,
        removed: result.data.removed_configurations,
        ...splitTemplate(written),
    };
}
