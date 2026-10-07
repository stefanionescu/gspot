import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/source.ts';
import { stripVTControlCharacters } from 'node:util';
import { extensionsTagged } from '#cli/repository/tags.ts';
import { pathMatcher } from '#cli/repository/selectors.ts';
import { toPosix, isInside } from '#cli/platform/paths.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { runCheckTool } from '#cli/execution/command/check.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import { toolOutputDetail } from '#cli/execution/command/failures.ts';
import { migrationsOf, migrationPaths } from '#cli/checks/database/postgres/migrations.ts';
import { denoLintReportSchema, supabaseProjectSchema } from '#cli/parsers/schema/supabase.ts';
import type { DenoLintReport, SupabaseConfigurationRead } from '#cli/types/parsers/supabase.ts';

import {
    DENO_LOCATION,
    SHARED_PREFIX,
    MIGRATION_NAME,
    ADMIN_KEY_NAMES,
    SUPABASE_CONFIG,
    ADMIN_KEY_EXTENSIONS,
} from '#cli/config/checks/platform/supabase.ts';

function configurationArguments(root: string, folder: string): string[] {
    const path = ['deno.json', 'deno.jsonc']
        .map((name) => join(root, folder, name))
        .find((entry) => statSync(entry, { throwIfNoEntry: false }) !== undefined);
    return path === undefined ? [] : ['--config', path];
}

function repositoryPath(root: string, locator: string): string {
    const path = locator.startsWith('file://') ? fileURLToPath(locator) : locator;
    const local = toPosix(relative(root, path));
    return local === '' || !isInside(local) ? path : local;
}

async function lintFunction(input: CheckInput, folder: string): Promise<Finding[]> {
    const argv = ['deno', 'lint', '--json', ...configurationArguments(input.root, folder), join(input.root, folder)];
    const result = await runCheckTool(input, argv, { cwd: input.scopeRoot });
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
function firstError(input: CheckInput, folder: string, stderr: string): Finding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : repositoryPath(input.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return findingAt(input, { file, line: Number(place?.['line'] ?? 1) }, 'type-error', first.trim());
}

async function checkFunctionTypes(input: CheckInput, folder: string): Promise<Finding[]> {
    const entry = ['index.ts', 'index.tsx']
        .map((name) => join(input.root, folder, name))
        .find((path) => statSync(path, { throwIfNoEntry: false }) !== undefined);
    if (entry === undefined) return [];
    const argv = ['deno', 'check', '--quiet', ...configurationArguments(input.root, folder), entry];
    const result = await runCheckTool(input, argv, { cwd: input.scopeRoot });
    return result.code === 0 ? [] : [firstError(input, folder, result.stderr)];
}

/**
 * The parsed project file or its syntax diagnostic; undefined when the scope has no project file.
 * @param input the selected project scope
 * @returns the parsed configuration or its diagnostic
 */
function readConfiguration(input: CheckInput): SupabaseConfigurationRead | undefined {
    const local = posix.join(input.scope, SUPABASE_CONFIG);
    const path = join(input.root, local);
    if (statSync(path, { throwIfNoEntry: false }) === undefined) return undefined;
    const text = readSource(input.root, local, input.reads).toString('utf8');
    try {
        return { config: supabaseProjectSchema.parse(parse(text)) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

/**
 * The folders that hold one edge function each: every folder under the functions folder with an index file.
 * @param input the check input
 * @returns the folder paths, repository-relative
 */
export function functionFolders(input: CheckInput): string[] {
    const setting = input.view.options('supabase')['functions_folder'] as string;
    const base = posix.join(input.scope, setting);
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
 * @param input the check input
 * @returns the findings
 */
export function supabaseConfiguration(input: CheckInput): Finding[] {
    const read = readConfiguration(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (read === undefined) return [];
    if ('error' in read) return [findingAt(input, at, 'syntax', read.error)];
    const { config } = read;
    const folders = new Set(functionFolders(input).map((folder) => posix.basename(folder)));
    const missing = (config.functions === undefined ? [] : Object.keys(config.functions)).filter(
        (name) => !folders.has(name),
    );
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
 * @param input the check input
 * @returns the findings
 */
export async function storagePolicies(input: CheckInput): Promise<Finding[]> {
    const read = readConfiguration(input);
    const at = { file: posix.join(input.scope, SUPABASE_CONFIG), line: 1 };
    if (read === undefined || 'error' in read) return []; // supabase/config reports project syntax errors.
    const { config } = read;
    const migrations = await migrationsOf(input);
    const policed = migrations
        .map((migration) => migration.text)
        .filter((text) => /policy/iu.test(text) && text.includes('storage.objects'));
    return (config.storage?.buckets === undefined ? [] : Object.keys(config.storage.buckets))
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
 * @param input the check input
 * @returns the findings
 */
export function migrationNames(input: CheckInput): Finding[] {
    return migrationPaths(input)
        .filter((path) => !MIGRATION_NAME.test(posix.basename(path)))
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'migration-name',
                'Name the migration <14-digit timestamp>_<snake_case>.sql.',
            ),
        );
}

/**
 * The deno lint findings of every edge function.
 * @param input the check input
 * @returns the findings
 */
export async function denoLint(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await lintFunction(input, folder)));
    return findings;
}

/**
 * The first type error of every edge function, from deno check over its entry file.
 * @param input the check input
 * @returns the findings
 */
export async function denoCheck(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) findings.push(...(await checkFunctionTypes(input, folder)));
    return findings;
}

/**
 * One finding when supabase.types_file differs from the types the CLI writes. Without the setting the check passes.
 * @param input the check input
 * @returns the findings
 */
export async function typesFresh(input: CheckInput): Promise<Finding[]> {
    const setting = input.view.options('supabase')['types_file'] as string;
    if (setting === '') return [];
    const path = posix.join(input.scope, setting);
    const at = { file: path, line: 1 };
    if (statSync(join(input.root, path), { throwIfNoEntry: false }) === undefined)
        return [
            findingAt(
                input,
                at,
                'missing',
                `Run supabase gen types typescript --local and write its output to ${setting}.`,
            ),
        ];
    const result = await runCheckTool(input, ['supabase', 'gen', 'types', 'typescript', '--local'], {
        cwd: input.scopeRoot,
    });
    if (result.code !== 0)
        throw new Error(
            `The supabase CLI wrote no types: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
        );
    const committed = readSource(input.root, path, input.reads).toString('utf8');
    if (committed.trim() === result.stdout.trim()) return [];
    return [
        findingAt(
            input,
            at,
            'stale',
            `The file differs from the local database types. Run supabase gen types typescript --local and write its output to ${setting}.`,
        ),
    ];
}

/**
 * Reports privileged Supabase keys outside supabase.admin_key_files and the effective test paths.
 * @param input the check input
 * @returns the findings
 */
export function adminKey(input: CheckInput): Finding[] {
    const allowed = input.view.options('supabase')['admin_key_files'] as string[];
    const tests = input.view.settings['tests'] as string[];
    const isAllowed = pathMatcher([...allowed, ...tests]);
    const extensions = [
        ...extensionsTagged('javascript', 'typescript', 'vue', 'svelte', 'astro', 'swift', 'python'),
        ...ADMIN_KEY_EXTENSIONS,
    ];
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isAllowed(input.scope === '' ? file.path : file.path.slice(input.scope.length + 1)) &&
            extensions.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readSource(input.root, file.path, input.reads)
            .toString('utf8')
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (ADMIN_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const diagnostic =
                    'This file names a privileged Supabase key, which bypasses row level security, outside the paths allowed to hold it.';
                return [findingAt(input, { file: file.path, line: index + 1 }, 'admin-key', diagnostic)];
            }),
    );
}
