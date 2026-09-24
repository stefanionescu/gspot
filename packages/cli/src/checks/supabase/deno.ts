import { z } from 'zod';
// Deno over every edge function, each with its own deno.json when it has one.
import { join } from 'node:path';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Finding } from '#cli/output/schema.ts';
import type { EngineInput } from '#cli/checks/input.ts';
import { runCheckCommand } from '#cli/run/tool-runner.ts';
import { functionFolders, supabaseFinding } from '#cli/checks/supabase/project.ts';

const lintReport = z.object({
    diagnostics: z.array(
        z.object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({ start: z.object({ line: z.number().int().positive() }) }),
        }),
    ),
    errors: z.array(z.object({ file_path: z.string(), message: z.string() })),
});
const CHECK_LOCATION = /at (?<file>file:\/\/\S+?):(?<line>\d+):\d+/u;

function denoFileArguments(root: string, folder: string): string[] {
    const path = join(root, folder, 'deno.json');
    return statSync(path, { throwIfNoEntry: false }) !== undefined ? ['--config', path] : [];
}

function relative(root: string, locator: string): string {
    const path = locator.startsWith('file://') ? fileURLToPath(locator) : locator;
    return path.startsWith(`${root}/`) ? path.slice(root.length + 1) : path;
}

async function linted(input: EngineInput, folder: string): Promise<Finding[]> {
    const argv = ['deno', 'lint', '--json', ...denoFileArguments(input.root, folder), join(input.root, folder)];
    const result = await runCheckCommand(input, argv, { cwd: join(input.root, input.scope) });
    const report = lintReport.parse(JSON.parse(result.stdout));
    if (result.code !== 0 && report.diagnostics.length === 0 && report.errors.length === 0)
        throw new Error(`Deno lint failed without diagnostics: ${result.stderr.trim()}`);
    const broken = report.errors.map((entry) =>
        supabaseFinding(input, { file: relative(input.root, entry.file_path), line: 1 }, 'parse', entry.message),
    );
    const found = report.diagnostics.map((entry) =>
        supabaseFinding(
            input,
            { file: relative(input.root, entry.filename), line: entry.range.start.line },
            entry.code,
            entry.message,
        ),
    );
    return [...broken, ...found];
}

// The first error deno check printed, at the file and line it names.
function firstError(input: EngineInput, folder: string, stderr: string): Finding {
    const said = Bun.stripANSI(stderr);
    const place = CHECK_LOCATION.exec(said)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : relative(input.root, place['file']);
    const first = said.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return supabaseFinding(input, { file, line: Number(place?.['line'] ?? 1) }, 'deno-check', first.trim());
}

async function typed(input: EngineInput, folder: string): Promise<Finding[]> {
    const entry = ['index.ts', 'index.tsx']
        .map((name) => join(input.root, folder, name))
        .find((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    if (entry === undefined) return [];
    const argv = ['deno', 'check', '--quiet', ...denoFileArguments(input.root, folder), entry];
    const result = await runCheckCommand(input, argv, { cwd: join(input.root, input.scope) });
    return result.code === 0 ? [] : [firstError(input, folder, result.stderr)];
}

async function overFunctions(
    input: EngineInput,
    each: (input: EngineInput, folder: string) => Promise<Finding[]>,
): Promise<Finding[]> {
    const findings: Finding[] = [];
    const folders = functionFolders(input);
    for (const folder of folders) findings.push(...(await each(input, folder)));
    return findings;
}

/**
 * The deno lint findings of every edge function.
 * @param input the engine input
 * @returns the findings
 */
export function denoLint(input: EngineInput): Promise<Finding[]> {
    return overFunctions(input, linted);
}

/**
 * The first type error of every edge function, from deno check over its entry file.
 * @param input the engine input
 * @returns the findings
 */
export function denoCheck(input: EngineInput): Promise<Finding[]> {
    return overFunctions(input, typed);
}
