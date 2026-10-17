import { z } from 'zod';
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '@decimalturn/toml-patch';
import { isRecord } from '#cli/system/values.ts';
import { join, posix, relative } from 'node:path';
import type { Parsed } from '#cli/types/errors.ts';
import { stripVTControlCharacters } from 'node:util';
import { buildFinding } from '#cli/checks/finding.ts';
import type { SchemaShape } from '#cli/types/shapes.ts';
import { walkSqlTree } from '#cli/parsers/sql/postgres.ts';
import { runCheckTool } from '#cli/checks/run/command/tool.ts';
import { buildPathMatcher } from '#cli/repository/matchers.ts';
import { listTaggedExtensions } from '#cli/repository/classify.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { readMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { readCachedText, readCachedBytes } from '#cli/system/files/reads.ts';
import { type Finding, type CheckInput } from '#cli/types/checks/run/check.ts';
import { formatOutputTail, assertToolFindings } from '#cli/checks/run/command/output.ts';
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
    SUPABASE_CONFIG_TOML,
} from '#cli/config/checks/platform/supabase.ts';

function buildDenoJsonArguments(root: string, folder: string): string[] {
    const path = DENO_CONFIG_FILES.map((name) => join(root, folder, name)).find(
        (entry) => statSync(entry, { throwIfNoEntry: false }) !== undefined,
    );
    return path === undefined ? [] : [DENO_CONFIG_FLAG, path];
}

function normalizeDenoPath(root: string, locator: string): string {
    const path = locator.startsWith(FILE_URL_PREFIX) ? fileURLToPath(locator) : locator;
    const local = convertToPosixPath(relative(root, path));
    return local === '' || !isInside(local) ? path : local;
}

function parseDenoCheckError(input: CheckInput, folder: string, stderr: string): Finding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : normalizeDenoPath(input.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return buildFinding(input, { file, line: Number(place?.['line'] ?? 1) }, 'type-error', first.trim());
}

/**
 * Parses the Supabase config.toml of a scope.
 * @param input the scope to read.
 * @returns the parsed file, its parse error, or undefined without a file.
 */
function readProjectFile(input: CheckInput): Parsed<SupabaseConfiguration> | undefined {
    const local = posix.join(input.scope.scope.path, SUPABASE_CONFIG_TOML);
    const text = readCachedText(input.reads, local);
    if (text === undefined) return undefined;
    try {
        return { value: supabaseProjectSchema.parse(parse(text)) };
    } catch (error) {
        return { error: error instanceof Error ? error.message : 'The file does not parse.' };
    }
}

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
 * Lists the entry file of each edge function: the first index file in each folder right under the functions folder,
 * except shared folders.
 * @param input the scope files and settings.
 * @returns the entry file paths, repository-relative.
 */
function listFunctionEntries(input: CheckInput): string[] {
    const base = input.scope.view.options('supabase').functions_folder;
    const entries = new Map<string, string>();
    for (const { path } of input.files) {
        const folder = posix.dirname(path);
        if (
            !path.startsWith(base + '/') ||
            !FUNCTION_ENTRY.test(path) ||
            folder.split('/').length !== base.split('/').length + 1 ||
            posix.basename(folder).startsWith(SHARED_PREFIX)
        )
            continue;
        if (!entries.has(folder)) entries.set(folder, path);
    }
    return [...entries.values()];
}

/**
 * Reports each storage bucket that no migration policy on storage.objects names.
 * @param input the scope with config.toml and migrations.
 * @returns the findings.
 */
export async function checkSupabaseStoragePolicies(input: CheckInput): Promise<Finding[]> {
    const read = readProjectFile(input);
    const at = { file: posix.join(input.scope.scope.path, SUPABASE_CONFIG_TOML), line: 1 };
    if (read === undefined || 'error' in read) return []; // files/taplo-format reports project syntax errors.
    const { value: config } = read;
    const { migrations, findings: syntax } = await readMigrations(input);
    if (syntax.length > 0) return syntax;
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
            buildFinding(
                input,
                at,
                'bucket-policy',
                `The bucket ${bucket} has no policy on storage.objects in any migration.`,
            ),
        );
}

/**
 * Runs deno lint on each edge function.
 * @param input the scope files to lint.
 * @returns the findings.
 */
export async function checkSupabaseDenoLint(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const entry of listFunctionEntries(input)) {
        const folder = posix.dirname(entry);
        const commandArguments = [
            ...DENO_LINT_COMMAND,
            ...buildDenoJsonArguments(input.root, folder),
            join(input.root, folder),
        ];
        const result = await runCheckTool(input, commandArguments, { cwd: join(input.root, input.scope.scope.path) });
        let report: DenoLintReport;
        try {
            report = denoLintReportSchema.parse(JSON.parse(result.stdout));
        } catch (error) {
            throw new Error(formatOutputTail(result, 'Deno lint printed a report that is not valid JSON.'), {
                cause: error,
            });
        }
        const broken = report.errors.map((entry) =>
            buildFinding(
                input,
                { file: normalizeDenoPath(input.root, entry.file_path), line: 1 },
                'syntax',
                entry.message,
            ),
        );
        const found = report.diagnostics.map((entry) =>
            buildFinding(
                input,
                { file: normalizeDenoPath(input.root, entry.filename), line: entry.range.start.line },
                entry.code,
                entry.message,
            ),
        );
        findings.push(...assertToolFindings(result, [...broken, ...found], 'deno lint'));
    }
    return findings;
}

/**
 * Reports the first type error of each edge function, from deno check on its entry file.
 * @param input the scope files to check.
 * @returns the findings.
 */
export async function checkSupabaseDenoTypes(input: CheckInput): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const entry of listFunctionEntries(input)) {
        const folder = posix.dirname(entry);
        const commandArguments = [
            ...DENO_CHECK_COMMAND,
            ...buildDenoJsonArguments(input.root, folder),
            join(input.root, entry),
        ];
        const result = await runCheckTool(input, commandArguments, { cwd: join(input.root, input.scope.scope.path) });
        if (result.code !== 0) findings.push(parseDenoCheckError(input, folder, result.stderr));
    }
    return findings;
}

/**
 * Reports privileged Supabase keys outside edge functions and test files.
 * @param input the scope files and allowed paths.
 * @returns the findings.
 */
export function checkServiceRoleKey(input: CheckInput): Finding[] {
    const folder = input.scope.view.options('supabase').functions_folder;
    const tests = input.scope.view.test_files;
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
                const message =
                    'This file names a privileged Supabase key, which bypasses row level security, outside the paths allowed to hold it.';
                return [buildFinding(input, { file: file.path, line: index + 1 }, 'admin-key', message)];
            }),
    );
}
