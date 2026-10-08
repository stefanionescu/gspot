// Run scoped Python import contracts and retain the dependency chains behind each broken contract.
import { parse } from 'smol-toml';
import { posix, basename } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { GspotError } from '#cli/platform/public.ts';
import { stripVTControlCharacters } from 'node:util';
import { readText } from '#cli/platform/root/public.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { getIniSection } from '#cli/parsers/tool/contracts.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import { pythonProjectCommand } from '#cli/tools/python/public.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import { importLinterSchema } from '#cli/parsers/schema/python/imports.ts';
import { BROKEN_CONTRACT, PYTHON_MANIFEST, IMPORT_CONTRACT_FILES } from '#cli/config/checks/language/python.ts';

function contractConfiguration(input: CheckInput): string | undefined {
    for (const file of IMPORT_CONTRACT_FILES) {
        const path = posix.join(input.scope, file);
        const text = readText(input.root, path, input.reads);
        if (text === undefined) continue;
        const declared =
            file === PYTHON_MANIFEST
                ? importLinterSchema.parse(parse(text)).tool?.importlinter !== undefined
                : getIniSection(text, 'importlinter') !== undefined;
        if (declared) {
            return path;
        }
    }
    return undefined;
}

/**
 * Run contracts from the first native INI or TOML configuration in the scope.
 * @param input the check input
 * @returns each broken contract with its native dependency chain
 */
export async function importLinter(input: CheckInput): Promise<Finding[]> {
    const configuration = contractConfiguration(input);
    if (configuration === undefined) throw new GspotError('skip', 'This scope has no import-linter configuration.');
    const result = await runCheckTool(
        input,
        pythonProjectCommand(input.selection, input.scopeRoot, [
            'lint-imports',
            '--config',
            basename(configuration),
            '--no-cache',
        ]),
        { cwd: input.scopeRoot },
    );
    const lines = stripVTControlCharacters(result.stdout).split('\n');
    const broken = lines.flatMap((line) => {
        const name = BROKEN_CONTRACT.exec(line.trim())?.groups?.['name'];
        return name === undefined ? [] : [name.trim()];
    });
    if (result.code !== 0 && broken.length === 0)
        throw new Error(
            `The lint-imports command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const heading = lines.findIndex((line) => line.trim() === 'Broken contracts');
    return broken.map((name) => {
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
}
