import { join } from 'node:path';
import { rmSync } from 'node:fs';
import type { Finding } from '#cli/checks/result.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { readSource } from '#cli/repository/tracked.ts';
import { commandArguments } from '#cli/platform/arguments.ts';
import { openConfinedRoot } from '#cli/platform/filesystem.ts';
import { scratchCopy } from '#cli/execution/file-workspace.ts';
import { runCheckCommand } from '#cli/execution/tool-runner.ts';
import { toolOutputDetail } from '#cli/execution/broken-tool.ts';

const SPECTRAL_LINE = /^(?<file>.+):(?<line>\d+):\d+ (?:error|warning) (?<rule>\S+) "(?<text>.*)"/u;

function setting(input: EngineInput, table: string, key: string): string {
    const found = input.view.tool(table)[key];
    return typeof found === 'string' ? found : '';
}

function finding(input: EngineInput, at: { file: string; line: number }, rule: string, text: string): Finding {
    return { check: input.spec.name, file: at.file, line: at.line, rule, message: text, fixable: false };
}

/**
 * Spectral over tools.openapi.document. With no document named the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function openapiLint(input: EngineInput): Promise<Finding[]> {
    const document = setting(input, 'openapi', 'document');
    if (document === '') return [];
    const files = openConfinedRoot(input.root, 'native');
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
        return [finding(input, { file: document, line: Number(groups['line']) }, groups['rule']!, groups['text']!)];
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
    const document = setting(input, 'openapi', 'document');
    const command = setting(input, 'openapi', 'produced_by');
    if (document === '' || command === '') return [];
    const before = readSource(input.root, document, input.observations);
    const scratch = scratchCopy(
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
            finding(
                input,
                { file: document, line: 1 },
                'stale',
                `Running ${command} changes this document; commit what it writes.`,
            ),
        ];
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
}
