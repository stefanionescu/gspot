import picomatch from 'picomatch';
import { isDeepStrictEqual } from 'node:util';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { ESLINT_INDENT, GSPOT_PRESET_LEVELS } from '#cli/config/configurations/blocks.ts';

import type {
    EslintReference,
    EslintFileWriter,
    EslintBlockFields,
    EslintCallArgument,
    PlannedEslintBlock,
} from '#cli/types/configurations/language.ts';
import {
    NAME_SEPARATOR,
    SHARED_LIST_MARK,
    PACKAGE_SCOPE_MARK,
    ESLINT_NAMED_IMPORTS,
    SHARED_LIST_REFERENCE,
    ESLINT_RUNTIMES_CONSTANT,
    ESLINT_PACKAGE_IMPORTERS,
} from '#cli/config/configurations/javascript.ts';

// eslint-disable-next-line gspot/no-trivial-functions -- reason: Each printed call records its import here, at one place.
function serializeCall(writer: EslintFileWriter, name: string, args: string[]): string {
    writer.functions.add(name);
    return `${name}(${args.join(', ')})`;
}

function serializeReference(writer: EslintFileWriter, { package: name, path }: EslintReference): string {
    const importer = ESLINT_PACKAGE_IMPORTERS[name];
    if (importer === undefined) writer.packages.add(name);
    const value =
        importer === undefined
            ? (ESLINT_NAMED_IMPORTS[name] ?? buildImportName(name))
            : serializeCall(writer, importer, []);
    const keys = path?.split('.') ?? [];
    return value + keys.map((key) => `[${JSON.stringify(key)}]`).join('');
}

function serializeValue(writer: EslintFileWriter, value: unknown): string {
    const text = JSON.stringify(
        value,
        (_key, member: unknown) => {
            const name = Array.isArray(member) ? writer.sharedLists.get(JSON.stringify(member)) : undefined;
            if (name === undefined) return member;
            writer.constants.set(name, JSON.stringify(member, null, JSON_INDENT));
            return SHARED_LIST_MARK + name;
        },
        JSON_INDENT,
    );
    return text.replaceAll(SHARED_LIST_REFERENCE, '$<name>');
}

function serializeArgument(writer: EslintFileWriter, argument: EslintCallArgument): string {
    if ('value' in argument) return serializeValue(writer, argument.value);
    if ('package' in argument) return serializeReference(writer, argument);
    const shipped = argument.plugins.map((plugin) => {
        const reference = typeof plugin === 'string' ? { package: plugin } : plugin;
        return `${JSON.stringify(writer.rulePrefixes.get(reference.package))}: ${serializeReference(writer, reference)}`;
    });
    const local = Object.entries('local' in argument ? argument.local : {}).map(([prefix, [importName, module]]) => {
        writer.modules.set(importName, module);
        return `${JSON.stringify(prefix)}: ${importName}`;
    });
    return `{ ${[...shipped, ...local].join(', ')} }`;
}

function serializeRuntimes({ runtimes, constants }: EslintFileWriter): string {
    const compiled = runtimes.map((runtime) => ({
        ...runtime,
        includes: runtime.includes.map((glob) => picomatch.makeRe(glob, { dot: true }).source),
        excludes: runtime.excludes.map((glob) => picomatch.makeRe(glob, { dot: true }).source),
    }));
    constants.set(ESLINT_RUNTIMES_CONSTANT, JSON.stringify(compiled, null, JSON_INDENT));
    return ESLINT_RUNTIMES_CONSTANT;
}

function buildScopeFields(writer: EslintFileWriter, block: PlannedEslintBlock): EslintBlockFields {
    const { fields, scope } = block;
    const { ignores: _ignores, ...blockFields } = fields;
    const ignores = [...(fields.ignores ?? []), ...(scope?.excluded ?? [])];
    return {
        ...blockFields,
        ...(scope !== undefined && {
            files: (fields.files ?? writer.codeFiles).map((pattern) => [
                ...(Array.isArray(pattern) ? pattern : [pattern]),
                joinScope(escapeGlob(scope.path), '**/*'),
            ]),
        }),
        ...(ignores.length > 0 && { ignores }),
    };
}

function serializeExtends(writer: EslintFileWriter, block: PlannedEslintBlock): string {
    const presets = (block.presets ?? [])
        .filter(({ merge }) => merge === 'fields')
        .map((preset) => {
            const value = serializeReference(writer, preset);
            return block.scope === undefined
                ? value
                : serializeCall(writer, 'stripRuntimeGlobals', [
                      value,
                      serializeReference(writer, { package: 'globals' }),
                  ]);
        });
    return `"extends": [${presets.join(', ')}]`;
}

function serializeFilePattern(
    writer: EslintFileWriter,
    value: NonNullable<PlannedEslintBlock['fields']['files']>[number],
): string {
    if (Array.isArray(value)) return `[${value.map((pattern) => serializeFilePattern(writer, pattern)).join(', ')}]`;
    if (typeof value === 'string') return JSON.stringify(value);
    if ('runtime' in value)
        return serializeCall(writer, 'buildRuntimeMatcher', [String(value.runtime), serializeRuntimes(writer)]);
    return serializeCall(
        writer,
        'buildComponentMatcher',
        value.component === 'vue'
            ? [serializeReference(writer, { package: 'vue-eslint-parser' })]
            : [
                  serializeReference(writer, { package: 'svelte-eslint-parser' }),
                  serializeReference(writer, { package: 'typescript-eslint', path: 'parser' }),
              ],
    );
}

function serializeFields(writer: EslintFileWriter, block: PlannedEslintBlock): string {
    const { files, ...fields } = block.fields;
    const members = Object.entries(fields).map(
        ([key, value]) => `${JSON.stringify(key)}: ${serializeValue(writer, value)}`,
    );
    if (block.presets?.some(({ merge }) => merge === 'fields') === true) members.push(serializeExtends(writer, block));
    if (files !== undefined)
        members.push(`"files": [${files.map((pattern) => serializeFilePattern(writer, pattern)).join(', ')}]`);
    return `{${members.join(',\n')}}`;
}

function buildBlockCalls(writer: EslintFileWriter, block: PlannedEslintBlock): string {
    const { presets = [], calls = [] } = block;
    let value = serializeFields(writer, block);
    for (const preset of presets.toReversed())
        if (preset.merge === 'rules')
            value = serializeCall(writer, 'mergePresetRules', [value, serializeReference(writer, preset)]);
    if (block.scope === undefined)
        value = serializeCall(writer, 'setLevelRules', [
            value,
            serializeReference(writer, { package: '@gspothq/eslint-plugin' }),
            JSON.stringify(GSPOT_PRESET_LEVELS[writer.level]),
        ]);
    for (const call of calls)
        value = serializeCall(writer, call.name, [
            value,
            ...call.args.map((argument) => serializeArgument(writer, argument)),
        ]);
    return value
        .split('\n')
        .map((line) => ESLINT_INDENT + line)
        .join('\n');
}

function isSameBlock(left: PlannedEslintBlock, right: PlannedEslintBlock): boolean {
    const [first, second] = [left, right].map((block) => ({
        ...block,
        scope: block.scope !== undefined,
        fields: { ...block.fields, files: block.fields.files === undefined },
    }));
    return left.fields.files !== undefined && right.fields.files !== undefined && isDeepStrictEqual(first, second);
}

/**
Build the name that a generated module gives an imported package or a configuration module.

@param name the package or configuration name.
*/
export function buildImportName(name: string): string {
    const unscoped = name.replace(PACKAGE_SCOPE_MARK, '');
    return unscoped.replaceAll(NAME_SEPARATOR, (_, letter: string) => letter.toUpperCase());
}

/**
Print blocks in order: each with the files of its scope, and adjacent blocks that differ only in their files as one
block. A block prints its fields, the presets it extends, and the calls that finish it.

@param writer the level, the code files, and the imports of the file.
@param blocks the blocks of the file.
*/
export function buildBlockList(writer: EslintFileWriter, blocks: PlannedEslintBlock[]): string[] {
    const merged: PlannedEslintBlock[] = [];
    for (const block of blocks) {
        const placed = { ...block, fields: buildScopeFields(writer, block) };
        const previous = merged.at(-1);
        if (previous === undefined || !isSameBlock(previous, placed)) merged.push(placed);
        else
            merged[merged.length - 1] = {
                ...previous,
                fields: {
                    ...previous.fields,
                    files: [...(previous.fields.files ?? []), ...(placed.fields.files ?? [])],
                },
            };
    }
    return merged.map((block) => buildBlockCalls(writer, block));
}
