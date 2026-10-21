// Print JavaScript imports, selectors, and readable ESLint configuration objects.
import ts from 'typescript';
import { isDeepStrictEqual } from 'node:util';
import type { Level } from '#cli/types/configurations.ts';
import { JSON_INDENT } from '#cli/config/generation/files.ts';
import { ESLINT_INDENT, COMPONENT_MATCHERS, ESLINT_BASE_IMPORTS } from '#cli/config/generation/eslint.ts';

import type {
    EslintPlugins,
    EslintRuntimeBlock,
    EslintFileSelector,
    EslintSettingsBlock,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

function serializeSelector(selector: EslintFileSelector): string {
    if (typeof selector === 'string') return JSON.stringify(selector);
    if ('component' in selector) return COMPONENT_MATCHERS[selector.component];
    return `runtimeMatches(${String(selector.runtime)}, runtimeDeclarations)`;
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
): string {
    const entries = rules === undefined ? [] : Object.entries(rules);
    const changed = Object.fromEntries(
        entries.filter(([name, value]) => !isDeepStrictEqual(value, preset.rules?.[name])),
    );
    const additions = Object.keys(changed).length === 0 ? '' : ', ' + serializeRules(changed, level);
    return `rules: { ...${preset.expression}${additions} }`;
}

/**
 * Serialize the lint rule and file fields that the generation baseline keeps.
 *
 * @param block the ESLint rule fields.
 * @param options plugin and preset expressions and the selected rule level.
 * @param options.properties plugin, parser, and settings expressions with no rule fields.
 * @param options.preset the declared ESLint export to spread.
 * @param options.level the selected ESLint rule level.
 *
 * @returns a JavaScript configuration block.
 */
function serializeBlock(
    block: EslintSettingsBlock,
    options: {
        properties?: string | undefined;
        preset?: EslintRuleExpression | undefined;
        level?: Level | undefined;
    } = {},
): string {
    const { files, rules, ...fields } = block;
    const { properties, preset, level } = options;
    const parts = properties === undefined || properties === '' ? [] : [properties];
    parts.push(...Object.entries(fields).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`));
    if (preset !== undefined) parts.push(serializePresetRules(rules, preset, level));
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
 *
 * @param runtimes the ordered runtime declarations and their file selectors.
 * @returns the JavaScript declaration shared by runtime file matchers.
 */
function serializeRuntimeSelectors(runtimes: EslintRuntimeBlock[]): string {
    return `const runtimeDeclarations = ${JSON.stringify(runtimes, null, JSON_INDENT)};\n`;
}

/**
 * Serialize the expression that reads the preset export of the manifest.
 *
 * @param variable the import name of the preset package.
 * @param source the dotted path of the export, or empty for the whole import.
 *
 * @returns the expression that reads the preset.
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
 * Serialize the fixed imports and the plugins before the fragment imports.
 *
 * @param plugins the import names and packages to load.
 * @param fragments additional imported bindings and packages.
 *
 * @returns the imports of the generated file.
 */
function serializeImports(plugins: EslintPlugins, fragments: EslintPlugins): string {
    const imports = new Map(
        [...ESLINT_BASE_IMPORTS, ...Object.values(plugins), ...Object.values(fragments)].map((entry) => [
            JSON.stringify(entry),
            entry,
        ]),
    );
    return (
        [...imports.values()]
            .map(([importName, source]) => `import ${importName} from ${JSON.stringify(source)};`)
            .join('\n') + '\n'
    );
}

/**
 * Indent every line of a generated ESLint block inside the export array.
 *
 * @param source a serialized block or comment.
 * @returns the indented text.
 */
function indentEslintBlock(source: string): string {
    return source
        .split('\n')
        .map((line) => ESLINT_INDENT + line)
        .join('\n');
}

export { serializeBlock, serializeImports, indentEslintBlock, serializePresetAccess, serializeRuntimeSelectors };
