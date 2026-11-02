import picomatch from 'picomatch';
import { escapeGlob } from '#cli/system/paths.ts';
import { joinScope } from '#cli/repository/scopes.ts';
import { JSON_INDENT } from '#cli/config/tools/installers.ts';
import { ESLINT_INDENT, GSPOT_PRESET_LEVELS } from '#cli/config/configurations/blocks.ts';

import {
    NAME_SEPARATOR,
    PACKAGE_SCOPE_MARK,
    ESLINT_NAMED_IMPORTS,
    ESLINT_PACKAGE_IMPORTERS,
} from '#cli/config/configurations/javascript.ts';
import type {
    EslintReference,
    EslintFileWriter,
    EslintBlockFields,
    EslintCallArgument,
    PlannedEslintBlock,
} from '#cli/types/configurations/language.ts';

/**
Build the name that a generated module gives an imported package or a configuration module.

@param name the package or configuration name.
*/
// eslint-disable-next-line gspot/no-trivial-functions -- reason: The block writer and the file writer share this one name format.
export function buildImportName(name: string): string {
    return name.replace(PACKAGE_SCOPE_MARK, '').replaceAll(NAME_SEPARATOR, (_, letter: string) => letter.toUpperCase());
}

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

function serializeArgument(writer: EslintFileWriter, argument: EslintCallArgument): string {
    if ('value' in argument) return JSON.stringify(argument.value, null, JSON_INDENT);
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

function serializeRuntimes({ runtimes }: EslintFileWriter): string {
    const compiled = runtimes.map((runtime) => ({
        ...runtime,
        includes: runtime.includes.map((glob) => picomatch.makeRe(glob, { dot: true }).source),
        excludes: runtime.excludes.map((glob) => picomatch.makeRe(glob, { dot: true }).source),
    }));
    return JSON.stringify(compiled, null, JSON_INDENT);
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

function serializeFields(writer: EslintFileWriter, block: PlannedEslintBlock): string {
    const { files, ...fields } = buildScopeFields(writer, block);
    const members = Object.entries(fields).map(
        ([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value, null, JSON_INDENT)}`,
    );
    if (block.presets?.some(({ merge }) => merge === 'fields') === true) members.push(serializeExtends(writer, block));
    if (files !== undefined) {
        const matcher = (value: (typeof files)[number]): string => {
            if (Array.isArray(value)) return `[${value.map((pattern) => matcher(pattern)).join(', ')}]`;
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
        };
        members.push(`"files": [${files.map((pattern) => matcher(pattern)).join(', ')}]`);
    }
    return `{${members.join(',\n')}}`;
}

/**
Print a block: its fields, the presets it extends, and the calls that finish it.

@param writer the level, the code files, and the imports of the file.
@param block the block, its scope, and its label.
*/
export function buildBlockCalls(writer: EslintFileWriter, block: PlannedEslintBlock): string {
    let value = serializeFields(writer, block);
    for (const preset of (block.presets ?? []).toReversed())
        if (preset.merge === 'rules')
            value = serializeCall(writer, 'mergePresetRules', [value, serializeReference(writer, preset)]);
    if (block.scope === undefined)
        value = serializeCall(writer, 'setLevelRules', [
            value,
            serializeReference(writer, { package: '@gspothq/eslint-plugin' }),
            JSON.stringify(GSPOT_PRESET_LEVELS[writer.level]),
        ]);
    for (const call of block.calls ?? [])
        value = serializeCall(writer, call.name, [
            value,
            ...call.args.map((argument) => serializeArgument(writer, argument)),
        ]);
    return value
        .split('\n')
        .map((line) => ESLINT_INDENT + line)
        .join('\n');
}
