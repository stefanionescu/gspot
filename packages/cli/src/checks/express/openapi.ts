import { commandArguments } from '#cli/policy/settings.ts';
import { readSource } from '#cli/repository/tracked.ts';
// The OpenAPI document of an express service: it lints, and it matches the code that writes it.
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { scratchCopy } from '#cli/run/fixers.ts';
import type { EngineInput } from '#cli/run/types.ts';
import type { Finding } from '#cli/output/finding.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { toolOutputDetail } from '#cli/run/broken-tool.ts';
import { openConfinedRoot } from '#cli/lifecycle/confined.ts';

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
        if (files.read('.gspot/spectral.yaml') === undefined)
            throw new Error('The Spectral configuration is missing. Run: gspot apply');
    } finally {
        files.close();
    }
    const ruleset = join(input.root, '.gspot/spectral.yaml');
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
    const before = readSource(input.root, document);
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
