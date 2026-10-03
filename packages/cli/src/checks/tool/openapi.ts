import { join } from 'node:path';
import { findingAt } from '#cli/execution/finding.ts';
import { openRoot } from '#cli/platform/filesystem.ts';
import { readSource } from '#cli/repository/sources.ts';
import { commandArguments } from '#cli/platform/quoting.ts';
import { scratchCopy } from '#cli/execution/tool/workspace.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { SPECTRAL_LINE } from '#cli/config/checks/tool/openapi.ts';
import { toolOutputDetail } from '#cli/execution/tool/findings.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/execution.ts';

/**
 * Spectral over tools.openapi.document. With no document named the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function spectral(input: EngineInput): Promise<Finding[]> {
    const named = input.view.tool('openapi')['document'];
    const document = typeof named === 'string' ? named : '';
    if (document === '') return [];
    using files = openRoot(input.root, 'native');
    files.source(document);
    if (files.read(`${CONFIGURATION_DIRECTORY}/spectral.yaml`) === undefined)
        throw new Error('The Spectral configuration is missing. Run: gspot apply');
    const ruleset = join(input.root, CONFIGURATION_DIRECTORY, 'spectral.yaml');
    const result = await runCheckCommand(
        input,
        ['spectral', 'lint', '--ruleset', ruleset, '--format', 'text', document],
        {
            cwd: input.root,
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
 * @param input the engine input
 * @returns the findings
 */
export async function fresh(input: EngineInput): Promise<Finding[]> {
    const { document: named, generate: producer } = input.view.tool('openapi');
    const document = typeof named === 'string' ? named : '';
    const command = typeof producer === 'string' ? producer : '';
    if (document === '' || command === '') return [];
    const before = readSource(input.root, document, input.reads);
    using scratchFolder = await scratchCopy(
        input.root,
        [...input.files.map((file) => file.path), document],
        input.scopeEntries.map((scope) => scope.path),
    );
    const scratch = scratchFolder.path;
    const result = await runCheckCommand(input, commandArguments(command), { cwd: scratch });
    if (result.code !== 0)
        throw new Error(
            `The command that writes the OpenAPI document failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
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
