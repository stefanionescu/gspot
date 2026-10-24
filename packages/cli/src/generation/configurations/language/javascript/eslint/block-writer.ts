import { serializeBlock } from '#cli/generation/configurations/language/javascript/eslint/print.ts';
import { ESLINT_INDENT } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';
import { buildScopeGlob, buildScopeFiles } from '#cli/generation/configurations/language/javascript/eslint/files.ts';

import type {
    BlockWriter,
    EslintBlockFields,
    PlannedEslintBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

function buildOptionBlocks(
    block: EslintBlockFields & { rules: Record<string, unknown> },
    writer: BlockWriter,
): EslintBlockFields[] {
    return writer.ruleOptions.flatMap((options): EslintBlockFields[] => {
        const chosenRules = Object.entries(block.rules).flatMap(([name, value]): [string, unknown][] => {
            const chosen = options.rules[name];
            const severity: unknown = Array.isArray(value) ? value[0] : value;
            return chosen === undefined || severity === 'off' || severity === 0 ? [] : [[name, [severity, ...chosen]]];
        });
        for (const [name] of chosenRules) writer.applied.add(name);
        if (chosenRules.length === 0) return [];
        return [
            {
                ...block,
                files: buildScopeFiles(block.files ?? writer.codeFiles, options.scope, options.includes),
                ignores: [...(block.ignores ?? []), ...options.excludes],
                rules: Object.fromEntries<unknown>(chosenRules),
            },
        ];
    });
}

function formatBlocks(blocks: EslintBlockFields[], planned: PlannedEslintBlock, level: BlockWriter['level']): string {
    return blocks
        .map((block, index) => {
            let runtimeText = '';
            let selectedPreset: EslintRuleExpression | undefined;
            let note = planned.label;
            if (index === 0) {
                runtimeText = planned.properties ?? '';
                selectedPreset = planned.preset;
                if (planned.preset !== undefined) note += ': ' + planned.preset.expression;
            } else note += ': your own rule options';
            const { ignores, ...fields } = block;
            const source = serializeBlock(
                { ...fields, ...(ignores !== undefined && ignores.length > 0 && { ignores }) },
                {
                    properties: runtimeText,
                    preset: selectedPreset,
                    level: planned.scope === undefined ? level : undefined,
                },
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
    const { fields: payload, scope } = block;
    const rules: Record<string, unknown> = Object.fromEntries(
        (payload.rules === undefined ? [] : Object.entries(payload.rules)).map(([name, value]) => [
            name,
            level !== 'all' && allLevelRules.has(name) ? 'off' : value,
        ]),
    );
    const ignores = [...(payload.ignores ?? []), ...(scope?.excluded ?? [])];
    const nested =
        scope === undefined
            ? {}
            : {
                  files: (payload.files ?? codeFiles).map((pattern) => [
                      ...(Array.isArray(pattern) ? pattern : [pattern]),
                      buildScopeGlob(scope.path),
                  ]),
                  ...(ignores.length > 0 && { ignores }),
              };
    const fields = { ...payload, ...nested, rules };
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
