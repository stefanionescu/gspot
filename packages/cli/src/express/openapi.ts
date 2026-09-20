// The OpenAPI document of an express service: it lints, and it matches the code that writes it.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
import { git, run } from '#cli/platform/spawn.ts';
import { locateTool } from '#cli/platform/tool-probe.ts';
import { MissingToolError } from '#cli/platform/missing-tool.ts';

const TOOL_TIMEOUT_MS = 300_000;
const SPECTRAL_LINE = /^(?<file>.+):(?<line>\d+):\d+ (?:error|warning) (?<rule>\S+) "(?<text>.*)"/u;

function setting(input: EngineInput, table: string, key: string): string {
    const found = input.view.tool(table)[key];
    return typeof found === 'string' ? found : '';
}

function finding(input: EngineInput, at: { file: string; line: number }, rule: string, text: string): Finding {
    return { check: input.spec.id, file: at.file, line: at.line, rule, message: text, fixable: false };
}

/**
 * Spectral over tools.openapi.document. With no document named the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function openapiLint(input: EngineInput): Promise<Finding[]> {
    const document = setting(input, 'openapi', 'document');
    if (document === '') return [];
    const binary = locateTool(input.root, 'spectral');
    if (binary === undefined) throw new MissingToolError('Spectral is not installed.');
    const ruleset = join(input.root, '.gspot/spectral.yaml');
    const result = await run([binary, 'lint', '--ruleset', ruleset, '--format', 'text', document], {
        cwd: input.root,
        timeoutMs: TOOL_TIMEOUT_MS,
    });
    const found = result.stdout.split('\n').flatMap((line): Finding[] => {
        const groups = SPECTRAL_LINE.exec(line.trim())?.groups;
        if (groups === undefined) return [];
        return [
            finding(
                input,
                { file: document, line: Number(groups['line']) },
                groups['rule'] ?? 'spectral',
                groups['text'] ?? '',
            ),
        ];
    });
    if (result.code !== 0 && found.length === 0)
        throw new Error(`Spectral failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
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
    const before = readFileSync(join(input.root, document), 'utf8');
    const result = await run(command.split(' '), { cwd: input.root, timeoutMs: TOOL_TIMEOUT_MS });
    if (result.code !== 0)
        throw new Error(
            `The command that writes the OpenAPI document failed: ${result.stderr.trim().split('\n').at(-1) ?? ''}`,
        );
    const after = readFileSync(join(input.root, document), 'utf8');
    if (before === after) return [];
    git(input.root, ['checkout', '--', document]);
    return [
        finding(
            input,
            { file: document, line: 1 },
            'stale',
            `Running ${command} changes this document; commit what it writes.`,
        ),
    ];
}
