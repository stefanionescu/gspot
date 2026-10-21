// Print JavaScript imports, selectors, and readable ESLint configuration objects.
import ts from 'typescript';
import { isDeepStrictEqual } from 'node:util';
import type { Level } from '#cli/types/configurations.ts';
import { COMPONENT_MATCHERS, ESLINT_BASE_IMPORTS } from '#cli/config/generation/eslint/print.ts';

import type {
    EslintPlugins,
    EslintBlockFields,
    EslintFileMatcher,
    EslintRuleExpression,
} from '#cli/types/generation/eslint.ts';

function serializeFileMatcher(matcher: EslintFileMatcher): string {
    if (typeof matcher === 'string') return JSON.stringify(matcher);
    if ('component' in matcher) return COMPONENT_MATCHERS[matcher.component];
    return `runtimeMatches(${String(matcher.runtime)}, runtimeDeclarations)`;
}

function serializeRules(rules: EslintBlockFields['rules'], level: Level | undefined): string {
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
    rules: EslintBlockFields['rules'],
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
export function serializeBlock(
    block: EslintBlockFields,
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
            if (!Array.isArray(entry)) return serializeFileMatcher(entry);
            const sources = entry.map((selector) => serializeFileMatcher(selector)).join(', ');
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
 * Serialize the expression that reads the preset export of the manifest.
 *
 * @param importName the import name of the preset package.
 * @param source the dotted path of the export, or empty for the whole import.
 *
 * @returns the expression that reads the preset.
 */
export function serializePresetAccess(importName: string, source: string): string {
    return (
        importName +
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
 * @param configurationPlugins additional imported bindings and packages.
 *
 * @returns the imports of the generated file.
 */
export function serializeImports(plugins: EslintPlugins, configurationPlugins: EslintPlugins): string {
    const imports = new Map(
        [...ESLINT_BASE_IMPORTS, ...Object.values(plugins), ...Object.values(configurationPlugins)].map((entry) => [
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
