import { z } from 'zod';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toPosix } from '#cli/platform/paths.ts';
import { findingAt } from '#cli/checks/result.ts';
import { stripVTControlCharacters } from 'node:util';
import { runCheckCommand } from '#cli/execution/tool/runner.ts';
import type { Finding, EngineInput } from '#cli/types/checks.ts';
import { CHECK_LOCATION } from '#cli/config/checks/platforms.ts';
import { functionFolders } from '#cli/checks/supabase/project.ts';
import { join, isAbsolute, relative as relativePath } from 'node:path';

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
// eslint-disable-next-line gspot/no-trivial-functions -- reason: Lint and check both pass the folder configuration when it exists; one owner keeps the flag.
function denoFileArguments(root: string, folder: string): string[] {
    const path = join(root, folder, 'deno.json');
    return statSync(path, { throwIfNoEntry: false }) === undefined ? [] : ['--config', path];
}

function relative(root: string, locator: string): string {
    const path = locator.startsWith('file://') ? fileURLToPath(locator) : locator;
    const local = toPosix(relativePath(root, path));
    return local === '' || local.startsWith('../') || isAbsolute(local) ? path : local;
}

async function linted(input: EngineInput, folder: string): Promise<Finding[]> {
    const argv = ['deno', 'lint', '--json', ...denoFileArguments(input.root, folder), join(input.root, folder)];
    const result = await runCheckCommand(input, argv, { cwd: join(input.root, input.scope) });
    const report = lintReport.parse(JSON.parse(result.stdout));
    if (result.code !== 0 && report.diagnostics.length === 0 && report.errors.length === 0)
        throw new Error(`Deno lint failed without diagnostics: ${result.stderr.trim()}`);
    const broken = report.errors.map((entry) =>
        findingAt(input, { file: relative(input.root, entry.file_path), line: 1 }, 'parse', entry.message),
    );
    const found = report.diagnostics.map((entry) =>
        findingAt(
            input,
            { file: relative(input.root, entry.filename), line: entry.range.start.line },
            entry.code,
            entry.message,
        ),
    );
    return [...broken, ...found];
}

// The first error from `deno check` with its reported file and line.
function firstError(input: EngineInput, folder: string, stderr: string): Finding {
    const said = stripVTControlCharacters(stderr);
    const place = CHECK_LOCATION.exec(said)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : relative(input.root, place['file']);
    const first = said.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return findingAt(input, { file, line: Number(place?.['line'] ?? 1) }, 'deno-check', first.trim());
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

/**
 * The deno lint findings of every edge function.
 * @param input the engine input
 * @returns the findings
 */
export async function denoLint(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await linted(input, folder)));
    return findings;
}

/**
 * The first type error of every edge function, from deno check over its entry file.
 * @param input the engine input
 * @returns the findings
 */
export async function denoCheck(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await typed(input, folder)));
    return findings;
}
