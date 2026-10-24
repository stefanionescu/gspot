import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isTable } from '#cli/system/tables.ts';
import { join, posix, relative } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import { buildFinding } from '#cli/runs/finding.ts';
import type { Session } from '#cli/types/session.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { readParsedFile } from '#cli/checks/syntax.ts';
import type { Finding } from '#cli/types/runs/check.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseToolReport } from '#cli/parsers/formats/json.ts';
import type { SpawnResult } from '#cli/types/system/processes.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { buildPathMatcher } from '#cli/repository/files/matchers.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/document.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { findCachedText, readCachedText } from '#cli/system/files/reads.ts';
import type { SupabaseProjectFile } from '#cli/types/checks/platform/supabase.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { formatOutputTail, assertToolFindings } from '#cli/runs/command/output.ts';
import { denoLintReportSchema, supabaseProjectFileSchema } from '#cli/schemas/checks/supabase.ts';

import {
    DENO_LOCATION,
    SHARED_PREFIX,
    FILE_URL_PREFIX,
    DENO_CONFIG_FLAG,
    DENO_CONFIG_FILES,
    DENO_LINT_COMMAND,
    DENO_CHECK_COMMAND,
    FUNCTION_ENTRYPOINT,
    SERVICE_ROLE_KEY_TAGS,
    SUPABASE_PROJECT_FILE,
    SERVICE_ROLE_KEY_NAMES,
    SERVICE_ROLE_KEY_EXTENSIONS,
} from '#cli/config/checks/platform/supabase.ts';

function walkSqlTree(value: unknown, visit: (key: string, child: unknown) => void): void {
    if (Array.isArray(value)) {
        for (const child of value) walkSqlTree(child, visit);
    } else if (value !== null && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            visit(key, child);
            walkSqlTree(child, visit);
        }
    }
}

function buildDenoJsonArguments(root: string, folder: string): string[] {
    const path = DENO_CONFIG_FILES.map((name) => join(root, folder, name)).find(
        (configPath) => statSync(configPath, { throwIfNoEntry: false }) !== undefined,
    );
    return path === undefined ? [] : [DENO_CONFIG_FLAG, path];
}

function normalizeDenoPath(root: string, locator: string): string {
    const path = locator.startsWith(FILE_URL_PREFIX) ? fileURLToPath(locator) : locator;
    const local = convertToPosixPath(relative(root, path));
    return local === '' || !isInside(local) ? path : local;
}

function parseDenoCheckError(session: Session, planned: PlannedCheck, folder: string, stderr: string): Finding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? `${folder}/index.ts` : normalizeDenoPath(session.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? 'The deno check command failed.';
    return buildFinding(planned, { file, line: Number(place?.['line'] ?? 1) }, 'type-error', first.trim());
}

function readSupabaseProjectFile(
    session: Session,
    planned: PlannedCheck,
): Parsed<SupabaseProjectFile, Finding> | undefined {
    const local = joinScope(planned.scope.folder.path, SUPABASE_PROJECT_FILE);
    const text = findCachedText(session.reads, local);
    return text === undefined
        ? undefined
        : readParsedFile(planned, local, () => parseTomlFile(local, text, supabaseProjectFileSchema));
}

function listFunctionEntrypoints(planned: PlannedCheck): string[] {
    const base = getTable(planned.scope.settings, 'supabase').functions_folder;
    const entrypoints = new Map<string, string>();
    for (const { path } of planned.files) {
        const folder = posix.dirname(path);
        if (
            !path.startsWith(base + '/') ||
            !FUNCTION_ENTRYPOINT.test(path) ||
            folder.split('/').length !== base.split('/').length + 1 ||
            posix.basename(folder).startsWith(SHARED_PREFIX)
        )
            continue;
        if (!entrypoints.has(folder)) entrypoints.set(folder, path);
    }
    return entrypoints.values().toArray();
}

// eslint-disable-next-line gspot/no-trivial-functions -- reason: 2 calls in this file share it.
async function runDenoCommand(
    session: Session,
    planned: PlannedCheck,
    command: readonly string[],
    folder: string,
): Promise<SpawnResult> {
    const commandArguments = [
        ...command.slice(0, -1),
        ...buildDenoJsonArguments(session.root, folder),
        ...command.slice(-1),
    ];
    return await runCheckTool(session, planned, commandArguments, {
        cwd: join(session.root, planned.scope.folder.path),
    });
}

/**
Reports each storage bucket that no migration policy on storage.objects names.

@param session the repository and its tools.
@param planned the scope with config.toml and migrations.
@returns the findings.
*/
export async function checkSupabaseStoragePolicies(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed === undefined) return [];
    if ('error' in parsed) return [parsed.error];
    const at = { file: joinScope(planned.scope.folder.path, SUPABASE_PROJECT_FILE), line: 1 };
    const projectFile = parsed.value;
    const migrations = await readParsedMigrations(session, planned);
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
            if (key !== 'A_Const' || !isTable(node)) return;
            const literal = isTable(node['sval']) ? node['sval']['sval'] : undefined;
            if (typeof literal === 'string') policed.add(literal);
        });
    return (projectFile.storage?.buckets === undefined ? [] : Object.keys(projectFile.storage.buckets))
        .filter((bucket) => !policed.has(bucket))
        .map((bucket) =>
            buildFinding(
                planned,
                at,
                'bucket-policy',
                `The bucket ${bucket} has no policy on storage.objects in any migration.`,
            ),
        );
}

/**
Runs deno lint on each edge function.

@param session the repository and its tools.
@param planned the scope files to lint.
@returns the findings.
*/
export async function checkSupabaseDenoLint(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const entrypoint of listFunctionEntrypoints(planned)) {
        const folder = posix.dirname(entrypoint);
        const result = await runDenoCommand(
            session,
            planned,
            [...DENO_LINT_COMMAND, join(session.root, folder)],
            folder,
        );
        if (result.code !== 0 && result.stdout.trim() === '')
            throw new Error(
                formatOutputTail(result, `deno lint stopped with exit ${String(result.code)} and no report.`),
            );
        const report = parseToolReport('deno lint', result.stdout, denoLintReportSchema);
        const broken = report.errors.map((error) =>
            buildFinding(
                planned,
                { file: normalizeDenoPath(session.root, error.file_path), line: 1 },
                'syntax',
                error.message,
            ),
        );
        const found = report.diagnostics.map((reported) =>
            buildFinding(
                planned,
                { file: normalizeDenoPath(session.root, reported.filename), line: reported.range.start.line },
                reported.code,
                reported.message,
            ),
        );
        findings.push(...assertToolFindings(result, [...broken, ...found], 'deno lint'));
    }
    return findings;
}

/**
Reports the first type error of each edge function, from deno check on its entry file.

@param session the repository and its tools.
@param planned the scope files to check.
@returns the findings.
*/
export async function checkSupabaseDenoCheck(session: Session, planned: PlannedCheck): Promise<Finding[]> {
    const findings: Finding[] = [];
    for (const entrypoint of listFunctionEntrypoints(planned)) {
        const folder = posix.dirname(entrypoint);
        const result = await runDenoCommand(
            session,
            planned,
            [...DENO_CHECK_COMMAND, join(session.root, entrypoint)],
            folder,
        );
        if (result.code !== 0) findings.push(parseDenoCheckError(session, planned, folder, result.stderr));
    }
    return findings;
}

/**
Reports privileged Supabase keys outside edge functions and test files.

@param session the repository and its tools.
@param planned the scope files and allowed paths.
@returns the findings.
*/
export function checkSupabaseServiceRoleKey(session: Session, planned: PlannedCheck): Finding[] {
    const folder = getTable(planned.scope.settings, 'supabase').functions_folder;
    const tests = planned.scope.settings.test_files;
    const isAllowed = buildPathMatcher([`${folder}/**`, ...tests]);
    const extensions = [...listTaggedExtensions(...SERVICE_ROLE_KEY_TAGS), ...SERVICE_ROLE_KEY_EXTENSIONS];
    const files = planned.files.filter(
        (file) =>
            file.kind === 'source' &&
            !isAllowed(file.path) &&
            extensions.some((extension) => file.path.endsWith(extension)),
    );
    return files.flatMap((file) =>
        readCachedText(session.reads, file.path)
            .split('\n')
            .flatMap((text, index): Finding[] => {
                if (SERVICE_ROLE_KEY_NAMES.every((name) => !text.includes(name))) return [];
                const message =
                    'This file names a privileged Supabase key, which bypasses row level security, outside the paths allowed to hold it.';
                return [buildFinding(planned, { file: file.path, line: index + 1 }, 'service-role-key', message)];
            }),
    );
}
