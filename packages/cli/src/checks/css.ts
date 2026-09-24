import { readSource } from '#cli/repository/tracked.ts';
import { parse } from 'postcss';
// CSS modules against the code that imports them: every class defined is read, and every class read is defined.
import type { EngineInput } from '#cli/types/execution.ts';
import type { Finding } from '#cli/types/reports.ts';
import { parse as parseScss } from 'postcss-scss';
import selectorParser from 'postcss-selector-parser';

const MODULE_SUFFIX = /\.module\.(?:css|scss|pcss)$/u;
const CODE_SUFFIX = /\.(?:tsx?|jsx?|mjs)$/u;

function moduleImport(name: string): RegExp {
    const escaped = name.replaceAll('.', String.raw`\.`);
    return new RegExp(String.raw`import\s+(?<binding>\w+)\s+from\s+['"][^'"]*${escaped}['"]`, 'u');
}

function camel(name: string): string {
    return name.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) => letter.toUpperCase());
}

function sheetFindings(
    input: EngineInput,
    sheet: string,
    defined: string[],
    code: { path: string; text: string }[],
): Finding[] {
    const name = sheet.slice(sheet.lastIndexOf('/') + 1);
    const importers = code.flatMap((file) => {
        const binding = moduleImport(name).exec(file.text)?.groups?.['binding'];
        return binding === undefined ? [] : [{ ...file, read: readClasses(file.text, binding) }];
    });
    if (importers.length === 0) return [];
    const known = new Set(defined.flatMap((entry) => [entry, camel(entry)]));
    const read = new Set(importers.flatMap((file) => file.read));
    const base = { check: input.spec.name, line: 1, fixable: false };
    const unused = defined
        .filter((entry) => !read.has(entry) && !read.has(camel(entry)))
        .map((entry) => ({
            ...base,
            file: sheet,
            rule: 'unused-class',
            message: `No importer reads the class ${entry}.`,
        }));
    const missing = importers.flatMap((file) =>
        file.read
            .filter((entry) => !known.has(entry))
            .map((entry) => ({
                ...base,
                file: file.path,
                rule: 'undefined-class',
                message: `${name} defines no class ${entry}.`,
            })),
    );
    return [...unused, ...missing];
}

function definedClasses(text: string, path: string): string[] {
    const sheet = path.endsWith('.scss') ? parseScss(text, { from: path }) : parse(text, { from: path });
    const found = new Set<string>();
    sheet.walkRules((rule) => {
        selectorParser()
            .astSync(rule.selector)
            .walkClasses((node) => {
                found.add(node.value);
            });
    });
    return [...found];
}

/**
 * The classes code reads from a module it binds to a name: binding.name and binding['name'].
 * @param text the code
 * @param binding the name the module is imported under
 * @returns the class names, once each
 */
export function readClasses(text: string, binding: string): string[] {
    const dotted = new RegExp(String.raw`\b${binding}\.(?<name>[A-Za-z_]\w*)`, 'gu');
    const indexed = new RegExp(String.raw`\b${binding}\[['"](?<name>[^'"]+)['"]\]`, 'gu');
    const found = [...text.matchAll(dotted), ...text.matchAll(indexed)].map((match) => match.groups?.['name'] ?? '');
    return [...new Set(found)];
}

/**
 * The findings of every CSS module of the scope.
 * @param input the engine input
 * @returns the findings
 */
export function cssModuleUsage(input: EngineInput): Finding[] {
    const paths = input.files.filter((file) => file.nature === 'source').map((file) => file.path);
    const code = paths
        .filter((path) => CODE_SUFFIX.test(path))
        .map((path) => ({ path, text: readSource(input.root, path).toString('utf8') }));
    const findings: Finding[] = [];
    const sheets = paths.filter((path) => MODULE_SUFFIX.test(path));
    for (const sheet of sheets) {
        const defined = definedClasses(readSource(input.root, sheet).toString('utf8'), sheet);
        findings.push(...sheetFindings(input, sheet, defined, code));
    }
    return findings;
}
