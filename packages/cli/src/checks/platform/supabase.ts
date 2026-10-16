import { z } from 'zod';
import { parse } from 'smol-toml';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isRecord } from '#cli/system/values.ts';
import { join, posix, relative } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import type { Parsed } from '#cli/types/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import type { SchemaShape } from '#cli/types/objects.ts';
import { walkSqlTree } from '#cli/parsers/sql/postgres.ts';
import { runCheckTool } from '#cli/execution/command/tool.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { readCachedText, readCachedBytes } from '#cli/system/files/reads.ts';
import { type Finding, type CheckInput } from '#cli/types/execution/check.ts';
import { toolFindings, toolOutputDetail } from '#cli/execution/command/output.ts';
import type { DenoLintReport, SupabaseConfiguration } from '#cli/types/checks/platform.ts';

import {
    DENO_LOCATION,
    SHARED_PREFIX,
    ADMIN_KEY_TAGS,
    FUNCTION_ENTRY,
    ADMIN_KEY_NAMES,
    FILE_URL_PREFIX,
    DENO_CONFIG_FLAG,
    DENO_CONFIG_FILES,
    DENO_LINT_COMMAND,
    DENO_CHECK_COMMAND,
    ADMIN_KEY_EXTENSIONS,
    FUNCTION_ENTRY_FILES,
    SUPABASE_CONFIG_TOML,
} from '#cli/config/checks/platform/supabase.ts';

function denoConfigArguments(root: string, folder: string): string[] {
    const path = DENO_CONFIG_FILES.map((name) => join(root, folder, name)).find(
        (entry) => statSync(entry, { throwIfNoEntry: false }) !== undefined,
    );
    return path === undefined ? [] : [DENO_CONFIG_FLAG, path];
}

function repositoryPath(root: string, locator: string): string {
    const path = locator.startsWith(FILE_URL_PREFIX) ? fileURLToPath(locator) : locator;
    const local = convertToPosixPath(relative(root, path));
    return local === '' || !isInside(local) ? path : local;
}

// The first error from `deno check` with its reported file and line.
function firstError(input: CheckInput, folder: string, stderr: string): Finding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : repositoryPath(input.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return findingAt(input, { file, line: Number(place?.['line'] ?? 1) }, 'type-error', first.trim());
}

/**
 * The parsed project file or its syntax diagnostic; undefined when the scope has no project file.
 * @param input the selected project scope.
 * @returns the parsed configuration or its diagnostic.
 */
function readConfigToml(input: CheckInput): Parsed<SupabaseConfiguration> | undefined {
    const local = posix.join(input.selection.scope.path, SUPABASE_CONFIG_TOML);
    const text = readCachedText(input.reads, local);
    if (text === undefined) return undefined;
    try {
        return { value: supabaseProjectSchema.parse(parse(text)) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

// Validate Supabase project declarations and the structured diagnostics of edge functions.

const supabaseProjectSchema = z.object({
    storage: z
        .object({ buckets: z.record(z.string(), z.unknown()).optional() } satisfies SchemaShape<
            NonNullable<SupabaseConfiguration['storage']>
        >)
        .optional(),
} satisfies SchemaShape<SupabaseConfiguration>);

const denoLintReportSchema = z.object({
    diagnostics: z.array(
        z.object({
            filename: z.string(),
            code: z.string(),
            message: z.string(),
            range: z.object({
                start: z.object({ line: z.number().int().positive() } satisfies SchemaShape<
                    NonNullable<NonNullable<NonNullable<DenoLintReport['diagnostics']>[number]['range']>['start']>
                >),
            } satisfies SchemaShape<NonNullable<NonNullable<DenoLintReport['diagnostics']>[number]['range']>>),
        } satisfies SchemaShape<NonNullable<DenoLintReport['diagnostics']>[number]>),
    ),
    errors: z.array(
        z.object({ file_path: z.string(), message: z.string() } satisfies SchemaShape<
            NonNullable<DenoLintReport['errors']>[number]
        >),
    ),
} satisfies SchemaShape<DenoLintReport>);

/**
 * The folders that hold one edge function each: every folder under the functions folder with an index file.
 * @param input the check input.
 * @returns the folder paths, repository-relative.
 */
function functionFolders(input: CheckInput): string[] {
    const base = input.selection.view.options('supabase').functions_folder;
    const folders = input.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${base}/`) && FUNCTION_ENTRY.test(path))
        .map((path) => path.slice(0, path.lastIndexOf('/')))
        .filter((folder) => folder.split('/').length === base.split('/').length + 1)
        .filter((folder) => !posix.basename(folder).startsWith(SHARED_PREFIX));
    return [...new Set(folders)];
}

/**
 * Every storage bucket of the project file has a policy on storage.objects that names it, in some migration.
 * @param input the check input.
 * @returns the findings.
 */
export async function supabaseStoragePolicies(input: CheckInput): Promise<Finding[]> {
    const read = readConfigToml(input);
    const at = { file: posix.join(input.selection.scope.path, SUPABASE_CONFIG_TOML), line: 1 };
    if (read === undefined || 'error' in read) return []; // supabase/project-file reports project syntax errors.
    const { value: config } = read;
    const migrations = await readMigrations(input);
    const policed = new Set<string>();
    const policies = migrations
        .flatMap((migration) => migration.statements)
        .flatMap((statement) =>
            statement.kind === 'CreatePolicyStmt' &&
            statement.fields.table?.schemaname === 'storage' &&
            statement.fields.table.relname === 'objects'
                ? [statement.fields]
                : [],
        );
    for (const fields of policies)
        walkSqlTree([fields.qual, fields.with_check], (key, node) => {
            if (key !== 'A_Const' || !isRecord(node)) return;
            const literal = isRecord(node['sval']) ? node['sval']['sval'] : undefined;
            if (typeof literal === 'string') policed.add(literal);
        });
    return (config.storage?.buckets === undefined ? [] : Object.keys(config.storage.buckets))
        .filter((bucket) => !policed.has(bucket))
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
 * The deno lint findings of every edge function.
 * @param input the check input.
 * @returns the findings.
 */
export async function supabaseDenoLint(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) {
        const argv = [...DENO_LINT_COMMAND, ...denoConfigArguments(input.root, folder), join(input.root, folder)];
        const result = await runCheckTool(input, argv, { cwd: join(input.root, input.selection.scope.path) });
        let report: DenoLintReport;
        try {
            report = denoLintReportSchema.parse(JSON.parse(result.stdout));
        } catch (error) {
            throw new Error(toolOutputDetail(result, 'Deno lint returned invalid JSON diagnostics'), { cause: error });
        }
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
        findings.push(...toolFindings(result, [...broken, ...found], 'deno lint'));
    }
    return findings;
}

/**
 * The first type error of every edge function, from deno check over its entry file.
 * @param input the check input.
 * @returns the findings.
 */
export async function supabaseDenoCheck(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const folder of functionFolders(input)) {
        const entry = FUNCTION_ENTRY_FILES.map((name) => join(input.root, folder, name)).find(
            (path) => statSync(path, { throwIfNoEntry: false }) !== undefined,
        );
        if (entry === undefined) continue;
        const argv = [...DENO_CHECK_COMMAND, ...denoConfigArguments(input.root, folder), entry];
        const result = await runCheckTool(input, argv, { cwd: join(input.root, input.selection.scope.path) });
        if (result.code !== 0) findings.push(firstError(input, folder, result.stderr));
    }
    return findings;
}

/**
 * Reports privileged Supabase keys outside edge functions and the configured test paths.
 * @param input the check input.
 * @returns the findings.
 */
export function supabaseServiceRoleKey(input: CheckInput): Finding[] {
    const folder = input.selection.view.options('supabase').functions_folder;
    const tests = input.selection.view.test_files;
    const isAllowed = buildPathMatcher([`${folder}/**`, ...tests]);
    const extensions = [...listTaggedExtensions(...ADMIN_KEY_TAGS), ...ADMIN_KEY_EXTENSIONS];
    const files = input.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isAllowed(file.path) &&
            extensions.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readCachedBytes(input.reads, file.path)
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
