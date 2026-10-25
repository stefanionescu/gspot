import { serializeBlock } from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import type { BlockWriter, EslintBlockFields, PlannedEslintBlock } from '#cli/types/generation/eslint.ts';
import { ESLINT_INDENT } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import { buildScopeGlob, buildScopeFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';

function buildOptionBlocks(
    block: EslintBlockFields & { rules: Record<string, unknown> },
    writer: BlockWriter,
): EslintBlockFields[] {
    return writer.ruleOptions.flatMap((options): EslintBlockFields[] => {
        const pickedRules = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
            const override = options.rules[name];
            const severity: unknown = Array.isArray(value) ? value[0] : value;
            return override === undefined || severity === 'off' || severity === 0
                ? []
                : [[name, [severity, ...override]]];
        });
        for (const [name] of pickedRules) writer.applied.add(name);
        if (pickedRules.length === 0) return [];
        return [
            {
                ...block,
                files: buildScopeFiles(block.files ?? writer.codeFiles, options.scope, options.includes),
                ignores: [...(block.ignores ?? []), ...options.excludes],
                rules: Object.fromEntries<unknown>(pickedRules),
            },
        ];
    });
}

function formatBlocks(blocks: EslintBlockFields[], planned: PlannedEslintBlock, level: BlockWriter['level']): string {
    const blockLevel = planned.scope === undefined ? level : undefined;
    const presetNote = planned.preset === undefined ? '' : `: ${planned.preset.expression}`;
    return blocks
        .map((block, index) => {
            const isFirst = index === 0;
            const properties = isFirst ? (planned.properties ?? '') : '';
            const preset = isFirst ? planned.preset : undefined;
            const note = `${planned.label}${isFirst ? presetNote : ': your own rule options'}`;
            const { ignores, ...fields } = block;
            const source = serializeBlock(
                { ...fields, ...(ignores !== undefined && ignores.length > 0 && { ignores }) },
                { properties, preset, level: blockLevel },
            );
            const value = planned.scope === undefined ? source : `stripRuntimeGlobals(${source}, globals)`;
            return `// ${note}\n${value}`
                .split('\n')
                .map((line) => ESLINT_INDENT + line)
                .join('\n');
        })
        .join(',\n');
}

/**
Print a block and record the rule options it applies.

@param writer the file's rule options and shared applied set.
@param block the block, its scope, and its label.
@returns the serialized block and any applicable option blocks.
*/
export function writeEslintBlock(writer: BlockWriter, block: PlannedEslintBlock): string {
    const { allLevelRules, level, codeFiles } = writer;
    const { fields: blockFields, scope } = block;
    const rules: Record<string, unknown> = Object.fromEntries(
        (blockFields.rules === undefined ? [] : Object.entries(blockFields.rules)).map(([name, value]) => [
            name,
            level !== 'all' && allLevelRules.has(name) ? 'off' : value,
        ]),
    );
    const ignores = [...(blockFields.ignores ?? []), ...(scope?.excluded ?? [])];
    const nested =
        scope === undefined
            ? {}
            : {
                  files: (blockFields.files ?? codeFiles).map((pattern) => [
                      ...(Array.isArray(pattern) ? pattern : [pattern]),
                      buildScopeGlob(scope.path),
                  ]),
                  ...(ignores.length > 0 && { ignores }),
              };
    const fields = { ...blockFields, ...nested, rules };
    return formatBlocks([fields, ...buildOptionBlocks(fields, writer)], block, level);
}

/**
List your rule options that no enabled block accepted.

@param writer the options and the shared applied set.
@returns the unapplied rule names.
*/
export function listUnappliedRules(writer: BlockWriter): string[] {
    return [
        ...new Set(
            writer.ruleOptions
                .flatMap((options) => Object.keys(options.rules))
                .filter((rule) => !writer.applied.has(rule)),
        ),
    ];
}
