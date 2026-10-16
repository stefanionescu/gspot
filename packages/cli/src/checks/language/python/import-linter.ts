import { z } from 'zod';
import { parse } from 'smol-toml';
import { join, posix, basename } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/system/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import type { SchemaShape } from '#cli/types/objects.ts';
import { readCachedText } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { toolFindings } from '#cli/execution/command/output.ts';
import { hasIniSection } from '#cli/repository/existing-tools.ts';
import { pythonProjectCommand } from '#cli/tools/python/project.ts';
import { PYPROJECT_TOML } from '#cli/config/parsers/dependency-files.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { BROKEN_CONTRACT, IMPORT_LINTER_FILES, LINT_IMPORTS_COMMAND } from '#cli/config/checks/language/python.ts';

// Run Python import contracts for one scope and retain the dependency chains behind each broken contract.

function importLinterFile(input: CheckInput): string | undefined {
    for (const file of IMPORT_LINTER_FILES) {
        const path = posix.join(input.selection.scope.path, file);
        const text = readCachedText(input.reads, path);
        if (text === undefined) continue;
        const declared =
            file === PYPROJECT_TOML
                ? importLinterSchema.parse(parse(text)).tool?.importlinter !== undefined
                : hasIniSection(text, 'importlinter');
        if (declared) {
            return path;
        }
    }
    return undefined;
}

const importLinterSchema = z.object({
    tool: z
        .object({ importlinter: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
            NonNullable<{ tool?: { importlinter?: Record<string, unknown> | undefined } | undefined }['tool']>
        >)
        .optional(),
} satisfies SchemaShape<{ tool?: { importlinter?: Record<string, unknown> | undefined } | undefined }>);

/**
 * Run contracts from the first INI or TOML tool file in the scope.
 * @param input the check input.
 * @returns each broken contract with its dependency chain.
 */
export async function importLinter(input: CheckInput): Promise<Finding[]> {
    const configuration = importLinterFile(input);
    if (configuration === undefined) throw new GspotError('skip', 'This scope has no import-linter configuration.');
    const result = await runCheckTool(
        input,
        pythonProjectCommand(input.selection, join(input.root, input.selection.scope.path), [
            ...LINT_IMPORTS_COMMAND,
            basename(configuration),
        ]),
        { cwd: join(input.root, input.selection.scope.path) },
    );
    const lines = stripVTControlCharacters(result.stdout).split('\n');
    const broken = lines.slice(lines.findIndex((line) => line.trim() === 'Contracts')).flatMap((line) => {
        const name = BROKEN_CONTRACT.exec(line.trim())?.groups?.['name'];
        return name === undefined ? [] : [name.trim()];
    });
    const heading = lines.findIndex((line) => line.trim() === 'Broken contracts');
    const findings = broken.map((name) => {
        const start = lines.findIndex((line, index) => index > heading && line.trim() === name);
        const next = lines.findIndex((line, index) => index > start && broken.includes(line.trim()));
        const end = next === -1 ? lines.length : next;
        const detail =
            start === -1
                ? ''
                : lines
                      .slice(start + 1, end)
                      .join('\n')
                      .trim();
        const diagnostic = [`The import contract "${name}" is broken.`, detail].filter(Boolean).join('\n');
        return findingAt(input, { file: configuration, line: 1 }, 'contract', diagnostic);
    });
    return toolFindings(result, findings, 'lint-imports');
}
