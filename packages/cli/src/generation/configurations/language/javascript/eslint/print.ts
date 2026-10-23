// Print JavaScript imports, selectors, and readable ESLint configuration objects.
import ts from 'typescript';
import { isDeepStrictEqual } from 'node:util';
import type { Level } from '#cli/types/configurations.ts';
import type { EslintBlockFields, EslintFileMatcher, EslintRuleExpression } from '#cli/types/generation/eslint.ts';
import { RUNTIME_DECLARATIONS } from '#cli/config/generation/configurations/language/javascript/eslint/config-file.ts';

import {
    ESLINT_FUNCTIONS,
    COMPONENT_MATCHERS,
    IMPORT_NAME_PUNCTUATION,
} from '#cli/config/generation/configurations/language/javascript/eslint/print.ts';

function serializeFileMatcher(matcher: EslintFileMatcher): string {
    if (typeof matcher === 'string') return JSON.stringify(matcher);
    if ('component' in matcher) return COMPONENT_MATCHERS[matcher.component];
    return `runtimeMatches(${String(matcher.runtime)}, ${RUNTIME_DECLARATIONS})`;
}

function serializeRules(rules: EslintBlockFields['rules'], level: Level | undefined): string {
    const pairs = rules === undefined ? [] : Object.entries(rules);
    return pairs
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
    const pairs = rules === undefined ? [] : Object.entries(rules);
    const changed = Object.fromEntries(
        pairs.filter(([name, value]) => !isDeepStrictEqual(value, preset.rules?.[name])),
    );
    const additions = Object.keys(changed).length === 0 ? '' : ', ' + serializeRules(changed, level);
    return `rules: { ...${preset.expression}${additions} }`;
}

/**
 * Print one ESLint block: its other properties, its rules against the preset it spreads, and its files.
 *
 * @param block the ESLint rule fields.
 * @param options plugin and preset expressions and the selected rule level.
 * @param options.properties plugin, parser, and settings expressions with no rule fields.
 * @param options.preset the declared ESLint export to spread.
 * @param options.level the gspot level, absent in configuration blocks so that gspot rules with level none stay on.
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
    const members = properties === undefined || properties === '' ? [] : [properties];
    members.push(...Object.entries(fields).map(([name, value]) => `${JSON.stringify(name)}: ${JSON.stringify(value)}`));
    if (preset !== undefined) members.push(serializePresetRules(rules, preset, level));
    else if (rules !== undefined && Object.keys(rules).length > 0)
        members.push(`rules: { ${serializeRules(rules, level)} }`);
    if (files !== undefined) {
        const expressions = files.map((file) => {
            if (!Array.isArray(file)) return serializeFileMatcher(file);
            const sources = file.map((selector) => serializeFileMatcher(selector)).join(', ');
            return `[${sources}]`;
        });
        members.push(`files: [${expressions.join(', ')}]`);
    }
    return printConfiguration(`{${members.join(', ')}}`);
}

// Rebuild objects and arrays as multiline syntax without changing their expressions.
function formatSyntaxNode(node: ts.Node, context: ts.TransformationContext): ts.VisitResult<ts.Node> {
    const child = ts.visitEachChild(node, (childNode) => formatSyntaxNode(childNode, context), context);
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
 * Serialize the expression that reads the preset export of the configuration.
 *
 * @param importName the import name of the preset package.
 * @param source the dotted path of the export, or empty for the whole import.
 * @returns the expression that reads the preset.
 */
export function serializePresetAccess(importName: string, source: string): string {
    return (
        importName +
        (source === ''
            ? ''
            : source
                  .split('.')
                  .map((segment) => `[${JSON.stringify(segment)}]`)
                  .join(''))
    );
}

// The names that a generated module reads: every identifier except object keys and the names after a dot.
function listReadNames(text: string): Set<string> {
    const names = new Set<string>();
    const visit = (node: ts.Node): void => {
        const isKey =
            (ts.isPropertyAssignment(node.parent) || ts.isPropertyAccessExpression(node.parent)) &&
            node.parent.name === node;
        if (ts.isIdentifier(node) && !isKey) names.add(node.text);
        ts.forEachChild(node, visit);
    };
    ts.forEachChild(ts.createSourceFile('eslint.mjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS), visit);
    return names;
}

/**
 * Print the imports of a generated ESLint config file: the shipped functions and the packages that its text reads.
 *
 * @param text the rest of the file.
 * @param imports the import names and packages that the file can read.
 * @param functionsPath the path of the shipped functions module, relative to the file.
 * @returns the import lines.
 */
export function serializeImports(
    text: string,
    imports: readonly (readonly [string, string])[],
    functionsPath: string,
): string {
    const read = listReadNames(text);
    const functions = ESLINT_FUNCTIONS.filter((name) => read.has(name));
    const lines =
        functions.length === 0 ? [] : [`import { ${functions.join(', ')} } from ${JSON.stringify(functionsPath)};`];
    for (const [importName, source] of new Map(
        imports.map((importPair) => [JSON.stringify(importPair), importPair]),
    ).values())
        if (
            importName
                .replaceAll(IMPORT_NAME_PUNCTUATION, '')
                .split(',')
                .some((name) => read.has(name))
        )
            lines.push(`import ${importName} from ${JSON.stringify(source)};`);
    return lines.join('\n') + '\n';
}
