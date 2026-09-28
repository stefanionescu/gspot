import { join } from 'node:path';
import { rm } from 'node:fs/promises';
import { openRoot } from '#cli/platform/filesystem.ts';
import { asText } from '#cli/policy/adoption/source.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { SPECTRAL_LINE } from '#cli/config/checks/express.ts';
import { commandArguments } from '#cli/platform/arguments.ts';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import { scratchCopy } from '#cli/execution/files/workspace.ts';
import { toolOutputDetail } from '#cli/execution/broken-tool.ts';
import type { Finding, EngineInput } from '#cli/types/checks/checks.ts';

/**
 * Spectral over tools.openapi.document. With no document named the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function openapiLint(input: EngineInput): Promise<Finding[]> {
    const document = asText(input.view.tool('openapi')['document']) ?? '';
    if (document === '') return [];
    const files = openRoot(input.root, 'native');
    try {
        files.source(document);
        if (files.read('.gspot/config/spectral.yaml') === undefined)
            throw new Error('The Spectral configuration is missing. Run: gspot apply');
    } finally {
        files.close();
    }
    const ruleset = join(input.root, '.gspot/config/spectral.yaml');
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
        return [
            {
                check: input.spec.name,
                file: document,
                line: Number(groups['line']),
                rule,
                message: text,
                fixable: false,
            },
        ];
    });
    if (result.code !== 0 && found.length === 0) throw new Error(toolOutputDetail(result, 'Spectral failed'));
    return found;
}

/**
 * Runs tools.openapi.produced_by and reports the document when the run changed it.
 * @param input the engine input
 * @returns the findings
 */
export async function openapiFresh(input: EngineInput): Promise<Finding[]> {
    const document = asText(input.view.tool('openapi')['document']) ?? '';
    const command = asText(input.view.tool('openapi')['produced_by']) ?? '';
    if (document === '' || command === '') return [];
    const before = readSource(input.root, document, input.observations);
    const scratch = await scratchCopy(
        input.root,
        [...input.files.map((file) => file.path), document],
        input.scopeEntries.map((scope) => scope.path),
    );
    try {
        const result = await runCheckCommand(input, commandArguments(command), { cwd: scratch });
        if (result.code !== 0)
            throw new Error(
                `The command that writes the OpenAPI document failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
            );
        const after = readSource(scratch, document);
        if (before.equals(after)) return [];
        return [
            {
                check: input.spec.name,
                file: document,
                line: 1,
                rule: 'stale',
                message: `Running ${command} changes this document; commit what it writes.`,
                fixable: false,
            },
        ];
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}
