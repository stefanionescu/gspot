import { posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { extensionOf } from '#cli/platform/paths.ts';
import { readSource } from '#cli/platform/source.ts';
import { extensionsTagged } from '#cli/repository/tags.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import type { EngineInput } from '#cli/types/execution/check.ts';
import { MODULE_SUFFIX } from '#cli/config/checks/language/css.ts';
import type { CssClass, Importer } from '#cli/types/parsers/css.ts';
import { definedClasses, moduleImporters } from '#cli/parsers/css.ts';

function sheetFindings(input: EngineInput, sheet: string, defined: CssClass[], importers: Importer[]): Finding[] {
    const name = posix.basename(sheet);
    if (importers.length === 0) return [];
    const known = new Set(
        defined.flatMap((entry) => [
            entry.name,
            entry.name.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) => letter.toUpperCase()),
        ]),
    );
    const read = new Set(importers.flatMap((file) => file.classes.map((entry) => entry.name)));
    const unused = importers.some((file) => file.isDynamic)
        ? []
        : defined
              .filter(
                  (entry) =>
                      !read.has(entry.name) &&
                      !read.has(
                          entry.name.replaceAll(/-(?<letter>[a-z\d])/gu, (_match, letter: string) =>
                              letter.toUpperCase(),
                          ),
                      ),
              )
              .map((entry) =>
                  findingAt(
                      input,
                      { file: sheet, line: entry.line },
                      'unused-class',
                      `No importer reads the class ${entry.name}.`,
                  ),
              );
    const missing = importers.flatMap((file) =>
        file.classes
            .filter((entry) => !known.has(entry.name))
            .map((entry) =>
                findingAt(
                    input,
                    { file: file.path, line: entry.line },
                    'undefined-class',
                    `${name} defines no class ${entry.name}.`,
                ),
            ),
    );
    return [...unused, ...missing];
}

/**
 * The findings of every CSS module of the scope.
 * @param input the engine input
 * @returns the findings
 */
export function moduleClasses(input: EngineInput): Finding[] {
    const paths = input.files.filter((file) => file.kind === 'source').map((file) => file.path);
    const extensions = new Set(extensionsTagged('javascript', 'typescript'));
    const code = paths
        .filter((path) => extensions.has(extensionOf(path)))
        .map((path) => ({ path, text: readSource(input.root, path, input.reads).toString('utf8') }));
    const findings: Finding[] = [];
    const sheets = paths.filter((path) => MODULE_SUFFIX.test(path));
    const importers = moduleImporters(code, new Set(sheets));
    for (const sheet of sheets) {
        const defined = definedClasses(readSource(input.root, sheet, input.reads).toString('utf8'), sheet);
        findings.push(...sheetFindings(input, sheet, defined, importers.get(sheet) ?? []));
    }
    return findings;
}
