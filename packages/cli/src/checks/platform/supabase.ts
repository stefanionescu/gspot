import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSource } from '#cli/platform/source.ts';
import { stripVTControlCharacters } from 'node:util';
import { findingAt } from '#cli/execution/finding.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import { runEngineTool } from '#cli/execution/command/runner.ts';
import { join, posix, relative as relativePath } from 'node:path';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { migrationsOf } from '#cli/checks/database/postgres/migrations.ts';
import type { Finding, EngineInput } from '#cli/types/execution/runtime.ts';
import type { DenoLintReport, SupabaseConfiguration } from '#cli/types/parsers/supabase.ts';
import { denoLintReportSchema, supabaseProjectSchema } from '#cli/parsers/schema/supabase.ts';

import {
    DENO_LOCATION,
    SHARED_PREFIX,
    MIGRATION_NAME,
    ADMIN_KEY_NAMES,
    ADMIN_KEY_PATHS,
    CODE_EXTENSIONS,
    SUPABASE_CONFIG,
    FUNCTIONS_DIRECTORY,
} from '#cli/config/checks/platform/supabase.ts';

function denoArguments(root: string, folder: string): string[] {
    const path = ['deno.json', 'deno.jsonc']
        .map((name) => join(root, folder, name))
        .find((entry) => statSync(entry, { throwIfNoEntry: false }) !== undefined);
    return path === undefined ? [] : ['--config', path];
}

function repositoryPath(root: string, locator: string): string {
    const path = locator.startsWith('file://') ? fileURLToPath(locator) : locator;
    const local = toPosix(relativePath(root, path));
    return local === '' || !isInside(local) ? path : local;
}

async function lintFunction(input: EngineInput, folder: string): Promise<Finding[]> {
    const argv = ['deno', 'lint', '--json', ...denoArguments(input.root, folder), join(input.root, folder)];
    const result = await runEngineTool(input, argv, { cwd: input.scopeRoot });
    if (![0, 1].includes(result.code) || (result.code !== 0 && result.stdout.trim() === ''))
        throw new Error(toolOutputDetail(result, 'Deno lint failed'));
    let report: DenoLintReport;
    try {
        report = denoLintReportSchema.parse(JSON.parse(result.stdout));
    } catch (error) {
        throw new Error(toolOutputDetail(result, 'Deno lint returned invalid JSON diagnostics'), { cause: error });
    }
    if (result.code !== 0 && report.diagnostics.length === 0 && report.errors.length === 0)
        throw new Error(`Deno lint failed without diagnostics: ${result.stderr.trim()}`);
    const broken = report.errors.map((entry) =>
        findingAt(input, { file: repositoryPath(input.root, entry.file_path), line: 1 }, 'syntax', entry.message),
    );
    const found = report.diagnostics.map((entry) =>
        findingAt(
            input,
            { file: repositoryPath(input.root, entry.filename), line: entry.range.start.line },
            entry.code,
            entry.message,
        ),
    );
    return [...broken, ...found];
}

// The first error from `deno check` with its reported file and line.
function firstError(input: EngineInput, folder: string, stderr: string): Finding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : repositoryPath(input.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return findingAt(input, { file, line: Number(place?.['line'] ?? 1) }, 'type-error', first.trim());
}

async function checkFunctionTypes(input: EngineInput, folder: string): Promise<Finding[]> {
    const entry = ['index.ts', 'index.tsx']
        .map((name) => join(input.root, folder, name))
        .find((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    if (entry === undefined) return [];
    const argv = ['deno', 'check', '--quiet', ...denoArguments(input.root, folder), entry];
    const result = await runEngineTool(input, argv, { cwd: input.scopeRoot });
    return result.code === 0 ? [] : [firstError(input, folder, result.stderr)];
}

/**
 * The parsed project file, or the text of the error when it does not parse, or undefined when the repository has none.
 * @param input the scoped repository read
 * @returns the config or the error
 */
export function readConfiguration(input: EngineInput): SupabaseConfiguration | string | undefined {
    const local = posix.join(input.scope, SUPABASE_CONFIG);
    const path = join(input.root, local);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    const text = readSource(input.root, local, input.reads).toString('utf8');
    try {
        return supabaseProjectSchema.parse(parse(text));
    } catch (error) {
        return error instanceof Error ? error.message : 'The file does not parse.';
    }
}

/**
 * The folders that hold one edge function each: every folder under the functions folder with an index file.
 * @param input the engine input
 * @returns the folder paths, repository-relative
 */
export function functionFolders(input: EngineInput): string[] {
    const named = input.view.options('supabase')['functions_folder'];
    const base = posix.join(input.scope, typeof named === 'string' && named !== '' ? named : FUNCTIONS_DIRECTORY);
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${base}/`) && /\/index\.tsx?$/u.test(path))
        .map((path) => path.slice(0, path.lastIndexOf('/')))
        .filter((folder) => folder.split('/').length === base.split('/').length + 1)
        .filter((folder) => !posix.basename(folder).startsWith(SHARED_PREFIX));
    return [...new Set(folders)];
}

/**
 * The project file parses, and every function it configures has a folder.
 * @param input the engine input
 * @returns the findings
 */
export function projectValid(input: EngineInput): Finding[] {
    const config = readConfiguration(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (config === undefined) return [];
    if (typeof config === 'string') return [findingAt(input, at, 'syntax', config)];
    const folders = new Set(functionFolders(input).map((folder) => posix.basename(folder)));
    const missing = Object.keys(config.functions ?? {}).filter((name) => !folders.has(name));
    return missing.map((name) =>
        findingAt(
            input,
            at,
            'function',
            `[functions.${name}] configures a function that has no folder with an index file.`,
        ),
    );
}

/**
 * Every storage bucket of the project file has a policy on storage.objects that names it, in some migration.
 * @param input the engine input
 * @returns the findings
 */
export async function storagePolicies(input: EngineInput): Promise<Finding[]> {
    const config = readConfiguration(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (config === undefined) return [];
    if (typeof config === 'string') return []; // The project configuration check reports syntax errors.
    const migrations = await migrationsOf(input);
    const policed = migrations
        .map((migration) => migration.text)
        .filter((text) => /policy/iu.test(text) && text.includes('storage.objects'));
    return Object.keys(config.storage?.buckets ?? {})
        .filter((bucket) => policed.every((text) => !text.includes(`'${bucket}'`)))
        .map((bucket) =>
            findingAt(
                input,
                at,
                'bucket-policy',
                `The bucket ${bucket} has no policy on storage.objects in any migration.`,
            ),
        );
}

/**
 * Every migration is named the way the Supabase CLI names one.
 * @param input the engine input
 * @returns the findings
 */
export async function migrationNames(input: EngineInput): Promise<Finding[]> {
    const migrations = await migrationsOf(input);
    return migrations
        .filter((migration) => !MIGRATION_NAME.test(migration.name))
        .map((migration) =>
            findingAt(
                input,
                { file: migration.path, line: 1 },
                'migration-name',
                'The name is fourteen digits, an underscore, and snake case words, ending in .sql.',
            ),
        );
}

/**
 * The deno lint findings of every edge function.
 * @param input the engine input
 * @returns the findings
 */
export async function denoLint(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await lintFunction(input, folder)));
    return findings;
}

/**
 * The first type error of every edge function, from deno check over its entry file.
 * @param input the engine input
 * @returns the findings
 */
export async function check(input: EngineInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await checkFunctionTypes(input, folder)));
    return findings;
}

/**
 * One finding when supabase.types_file differs from the types the CLI writes. Without the setting the check passes.
 * @param input the engine input
 * @returns the findings
 */
export async function typesFresh(input: EngineInput): Promise<Finding[]> {
    const named = input.view.options('supabase')['types_file'];
    if (typeof named !== 'string' || named === '') return [];
    const path = posix.join(input.scope, named);
    const at = { file: path, line: 1 };
    if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
        return [findingAt(input, at, 'stale', 'The types file does not exist.')];
    const result = await runEngineTool(input, ['supabase', 'gen', 'types', 'typescript', '--local'], {
        cwd: join(input.root, input.scope),
    });
    if (result.code !== 0)
        throw new Error(`The supabase CLI wrote no types: ${result.stderr.trim().split('\n').at(-1) ?? ''}`);
    const committed = readSource(input.root, path, input.reads).toString('utf8');
    if (committed.trim() === result.stdout.trim()) return [];
    return [findingAt(input, at, 'stale', 'The file differs from the types the local database gives. Write it again.')];
}

/**
 * One finding for each line that names the service role key outside supabase.admin_key_files.
 * @param input the engine input
 * @returns the findings
 */
export function adminKey(input: EngineInput): Finding[] {
    const named = input.view.options('supabase')['admin_key_files'] as string[] | undefined;
    const isAllowed = pathMatcher(named ?? ADMIN_KEY_PATHS);
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isAllowed(input.scope === '' ? file.path : file.path.slice(input.scope.length + 1)) &&
            CODE_EXTENSIONS.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readSource(input.root, file.path, input.reads)
            .toString('utf8')
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (ADMIN_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const said =
                    'This file names the service role key, which bypasses row level security, outside the paths allowed to hold it.';
                return [findingAt(input, { file: file.path, line: index + 1 }, 'admin-key', said)];
            }),
    );
}
