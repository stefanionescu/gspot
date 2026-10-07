import { statSync } from 'node:fs';
import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { openRoot } from '#cli/platform/root/open.ts';
import { parseCommand } from '#cli/parsers/command.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { nativeSegments } from '#cli/platform/root/rules.ts';
import { copyIntoScratch } from '#cli/execution/copy/files.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { SPECTRAL_LINE } from '#cli/config/checks/tool/openapi.ts';
import { targetInScope } from '#cli/configurations/declarations.ts';
import type { ConfigurationFile } from '#cli/types/configurations.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';

function documentPath(input: CheckInput): string | undefined {
    const document = input.view.options('tools.openapi')['document'] as string;
    if (document === '') return undefined;
    nativeSegments(document);
    const path = posix.join(input.scope, document);
    if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
        throw new Error(`The tools.openapi.document setting names ${path}, which does not exist.`);
    using files = openRoot(input.root, 'native');
    files.assertInside(path);
    return path;
}

/**
 * Spectral over tools.openapi.document. With no document named the check passes.
 * @param input the check input
 * @returns the findings
 */
export async function spectral(input: CheckInput): Promise<Finding[]> {
    const document = documentPath(input);
    if (document === undefined) return [];
    const configuration = input.selection.selected
        .flatMap((manifest) => manifest.configs)
        .find((entry) => entry.tool.includes('spectral')) as ConfigurationFile;
    const target = targetInScope(input.scope, configuration);
    using files = openRoot(input.root);
    if (files.read(target) === undefined) throw new Error('The Spectral configuration is missing. Run: gspot apply');
    const ruleset = join(input.root, target);
    const result = await runCheckTool(
        input,
        ['spectral', 'lint', '--ruleset', ruleset, '--format', 'text', posix.relative(input.scope || '.', document)],
        {
            cwd: input.scopeRoot,
        },
    );
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = SPECTRAL_LINE.exec(line.trim())?.groups;
        if (groups === undefined) return [];
        const rule = groups['rule'];
        if (rule === undefined) return [];
        const text = groups['text'];
        if (text === undefined) return [];
        return [findingAt(input, { file: document, line: Number(groups['line']) }, rule, text)];
    });
    if (result.code !== 0 && found.length === 0) throw new Error(toolOutputDetail(result, 'Spectral failed'));
    return found;
}

/**
 * Runs tools.openapi.generate and reports the document when the run changed it.
 * @param input the check input
 * @returns the findings
 */
export async function openapiFresh(input: CheckInput): Promise<Finding[]> {
    const command = input.view.options('tools.openapi')['generate'] as string;
    if (command === '') return [];
    const document = documentPath(input);
    if (document === undefined) return [];
    const before = readSource(input.root, document, input.reads);
    using scratchFolder = await copyIntoScratch(
        input.root,
        [...input.files.map((file) => file.path), document],
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const result = await runCheckTool(input, parseCommand(command), { cwd: join(scratch, input.scope) });
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
            `Running ${command} changes this document; commit what it writes.`,
        ),
    ];
}
