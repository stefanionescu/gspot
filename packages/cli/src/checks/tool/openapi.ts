import { join } from 'node:path';
import { statSync } from 'node:fs';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { nativeSegments } from '#cli/platform/root/rules.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';

function documentPath(input: CheckInput): string | undefined {
    const path = input.view.options('openapi')['document'];
    if (path === '') return undefined;
    nativeSegments(path);
    if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
        throw new Error(`The openapi.document setting names ${path}, which does not exist.`);
    using files = openRoot(input.root, 'native');
    files.assertInside(path);
    return path;
}

/**
 * Runs openapi.generate_command and reports the document when the run changed it.
 * @param input the check input
 * @returns the findings
 */
export async function openapiFresh(input: CheckInput): Promise<Finding[]> {
    const command = input.view.options('openapi')['generate_command'];
    if (command.length === 0) return [];
    const document = documentPath(input);
    if (document === undefined) return [];
    const before = readSource(input.root, document, input.reads);
    using scratchFolder = await copyIntoScratch(input, [document]);
    const scratch = scratchFolder.path;
    const result = await runCheckTool(input, command, { cwd: join(scratch, input.scope) });
    if (result.code !== 0)
        throw new Error(
            `The command that writes the OpenAPI document failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const after = readSource(scratch, document);
    if (before.equals(after)) return [];
    return [
        findingAt(
            input,
            { file: document, line: 1 },
            'stale',
            `Running ${JSON.stringify(command)} changes this document; commit what it writes.`,
        ),
    ];
}
