import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { z } from 'zod';

import { LOCAL_RECORDS } from '#cli/config/commands/edits.ts';
import { LEFT_OUT_NOTES } from '#cli/config/settings/schema.ts';
import { listUnknownConfigurations } from '#cli/manifests/select.ts';
import { parseTomlFile, parseTomlSyntax } from '#cli/parsers/formats/toml.ts';
import { settingsSchema } from '#cli/schemas/settings/file.ts';
import { setKey } from '#cli/settings/edit.ts';
import { findSettingSchema, unwrapSettingSchema } from '#cli/settings/lookup.ts';
import { formatSettingsErrors } from '#cli/settings/validation/messages.ts';
import { formatSettingsIssue } from '#cli/settings/validation/schema.ts';
import { GspotError, hasErrorCode } from '#cli/system/errors.ts';
import { decodeUtf8 } from '#cli/system/files/reads.ts';
import { isTable } from '#cli/system/tables.ts';
import type { LeftOutSetting, Template } from '#cli/types/generation.ts';
import type { SettingDefinition, TomlTable } from '#cli/types/settings.ts';

function isSettingsTable(schema: z.ZodType): boolean {
    let inner = unwrapSettingSchema(schema);
    while (inner instanceof z.ZodPipe) inner = unwrapSettingSchema(inner.in as z.ZodType);
    return inner instanceof z.ZodObject && schema.meta()?.['reasoned'] !== true;
}

function listSettingValues(table: TomlTable, prefix: string): Array<{ key: string; value: unknown }> {
    return Object.entries(table).flatMap(([name, value]) => {
        const key = prefix === '' ? name : `${prefix}.${name}`;
        const schema = findSettingSchema(key);
        return schema !== undefined && isTable(value) && isSettingsTable(schema)
            ? listSettingValues(value, key)
            : [{ key, value }];
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
    const local = (schema?.meta() as SettingDefinition | undefined)?.leftOut;
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
