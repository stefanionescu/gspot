// Print JavaScript imports, selectors, and readable ESLint configuration objects.
import ts from 'typescript';
import { isDeepStrictEqual } from 'node:util';
import type { Level } from '#cli/types/configurations.ts';
import { JSON_INDENT } from '#cli/config/generation/tool-projects.ts';
import { ESLINT_INDENT, ESLINT_BASE_IMPORTS } from '#cli/config/generation/eslint.ts';

import type {
    EslintParts,
    BlockWriter,
    EslintPlugins,
    EslintFileSelector,
    EslintSettingsBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

function serializeSelector(selector: EslintFileSelector): string {
    if (typeof selector === 'string') return JSON.stringify(selector);
    if ('component' in selector)
        return `componentMatches(${selector.component}Parser, ${JSON.stringify(selector.component)}, tseslint.parser)`;
    return `runtimeMatches(${String(selector.runtime.index)}, runtimeDeclarations)`;
}

function serializeRules(rules: EslintSettingsBlock['rules'], level: Level | undefined): string {
    const entries = rules === undefined ? [] : Object.entries(rules);
    return entries
        .map(([name, value]) => {
            const configured: unknown[] = Array.isArray(value) ? value : [value];
            const [severity, ...options] = configured;
            const source =
                name.startsWith('gspot/') && level !== undefined && severity !== 'off' && severity !== 0
                    ? `gspot.configs.${level}.rules[${JSON.stringify(name)}] ?? 'off'`
                    : JSON.stringify(severity);
            const suffix =
                options.length === 0 ? '' : ', ' + options.map((option) => JSON.stringify(option)).join(', ');
            const setting = Array.isArray(value) ? `[${source}${suffix}]` : source;
            return `${JSON.stringify(name)}: ${setting}`;
        })
        .join(', ');
}

function serializePresetRules(
    rules: EslintSettingsBlock['rules'],
    preset: EslintRuleExpression,
    level: Level | undefined,
): string[] {
    const entries = rules === undefined ? [] : Object.entries(rules);
    const changed = Object.fromEntries(
        entries.filter(([name, value]) => !isDeepStrictEqual(value, preset.rules?.[name])),
    );
    const additions = Object.keys(changed).length === 0 ? '' : ', ' + serializeRules(changed, level);
    return [`rules: { ...${preset.expression}${additions} }`];
}

/**
 * Serialize the same rule and applicability fields retained in the generation baseline.
 *
 * @param block the actual ESLint rule fields.
 * @param runtime plugin, parser, and settings expressions that contain no rule fields.
 * @param preset the declared ESLint preset.
 * @param level the selected ESLint plugin configuration.
 *
 * @returns a JavaScript configuration block.
 */
function serializeBlock(
    block: EslintSettingsBlock,
    runtime: string,
    preset: EslintRuleExpression | undefined,
    level?: Level,
): string {
    const { files, rules, ...fields } = block;
    const content = {
        ...fields,
    };
    const parts = runtime === '' ? [] : [runtime];
    parts.push(...Object.entries(content).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`));
    if (preset !== undefined) parts.push(...serializePresetRules(rules, preset, level));
    else if (rules !== undefined && Object.keys(rules).length > 0)
        parts.push(`rules: { ${serializeRules(rules, level)} }`);
    if (files !== undefined) {
        const expressions = files.map((entry) => {
            if (!Array.isArray(entry)) return serializeSelector(entry);
            const sources = entry.map((selector) => serializeSelector(selector)).join(', ');
            return `[${sources}]`;
        });
        parts.push(`files: [${expressions.join(', ')}]`);
    }
    return printConfiguration(`{${parts.join(', ')}}`);
}

// Rebuild objects and arrays as multiline syntax without changing their expressions.
function formatSyntaxNode(node: ts.Node, context: ts.TransformationContext): ts.VisitResult<ts.Node> {
    const child = ts.visitEachChild(node, (entry) => formatSyntaxNode(entry, context), context);
    if (ts.isObjectLiteralExpression(child)) {
        const fields = child.properties.map((property) => {
            if (ts.isPropertyAssignment(property))
                return context.factory.createPropertyAssignment(property.name, property.initializer);
            if (ts.isSpreadAssignment(property)) return context.factory.createSpreadAssignment(property.expression);
            return property;
        });
        return ts.setTextRange(context.factory.createObjectLiteralExpression(fields, true), child);
    }
    if (ts.isArrayLiteralExpression(child)) {
        const elements = child.elements.map((element) =>
            ts.isStringLiteral(element) ? context.factory.createStringLiteral(element.text) : element,
        );
        return ts.setTextRange(context.factory.createArrayLiteralExpression(elements, true), child);
    }
    return child;
}

// The constructed export always contains one expression and the transformer preserves it.
function printConfiguration(literal: string): string {
    const source = ts.createSourceFile(
        'eslint-block.js',
        `export default ${literal};`,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.JS,
    );
    const declaration = source.statements[0] as ts.ExportAssignment;
    const printed = ts.transform(declaration.expression, [
        (context) => (node) => formatSyntaxNode(node, context) as ts.Expression,
    ]);
    const [expression] = printed.transformed as [ts.Expression, ...ts.Expression[]];
    try {
        return ts
            .createPrinter({ newLine: ts.NewLineKind.LineFeed })
            .printNode(ts.EmitHint.Expression, expression, source);
    } finally {
        printed.dispose();
    }
}

/**
 * Serialize the runtime declarations used by the shared file selectors.
 * @param runtimes the ordered runtime declarations and their file selectors.
 * @returns the JavaScript declaration shared by runtime file matchers.
 */
function serializeRuntimeSelectors(runtimes: EslintParts['runtimes']): string {
    return `const runtimeDeclarations = ${JSON.stringify(runtimes, null, JSON_INDENT)};\n`;
}

/**
 * Serialize access to the manifest's actual preset export.
 *
 * @param variable the runtime settings importName.
 * @param source the source paths and dependency trees.
 *
 * @returns the import expression for the declared preset.
 */
function serializePresetAccess(variable: string, source: string): string {
    return (
        variable +
        (source === ''
            ? ''
            : source
                  .split('.')
                  .map((part) => `[${JSON.stringify(part)}]`)
                  .join(''))
    );
}

/**
 * Serialize fixed imports and selected plugins before the fragment import statements.
 *
 * @param plugins the selected formatter plugins.
 * @param fragments the emitted configuration fragments.
 *
 * @returns the imports used by the generated configuration.
 */
function serializeImports(plugins: EslintPlugins, fragments: string): string {
    return (
        [...ESLINT_BASE_IMPORTS, ...Object.values(plugins)]
            .map(([importName, source]) => `import ${importName} from ${JSON.stringify(source)};`)
            .join('\n') +
        '\n' +
        fragments +
        '\n'
    );
}

/**
 * Serialize ordered block descriptors and retain the module's calculated rule settings.
 *
 * @param module the named architecture module.
 * @param blocks the emitted ESLint blocks.
 *
 * @returns the serialized ESLint blocks.
 */
function serializeBlocks(module: BlockWriter, blocks: Parameters<BlockWriter['block']>[]): string {
    return blocks.map((block) => '\n' + module.block(...block) + ',\n').join('');
}

/**
 * Indent every line of an emitted ESLint block beneath its configuration array.
 * @param source the already serialized block or explanatory comment.
 * @returns the block text with the shared indentation.
 */
function indentEslintBlock(source: string): string {
    return source
        .split('\n')
        .map((line) => ESLINT_INDENT + line)
        .join('\n');
}

export {
    serializeBlock,
    serializeBlocks,
    serializeImports,
    indentEslintBlock,
    serializePresetAccess,
    serializeRuntimeSelectors,
};
