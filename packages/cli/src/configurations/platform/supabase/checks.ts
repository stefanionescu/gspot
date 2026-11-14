import { statSync } from 'node:fs';
import type { Node } from '@pgsql/types';
import { fileURLToPath } from 'node:url';
import { CheckStop } from '#cli/system/errors.ts';
import { join, posix, relative } from 'node:path';
import { getTable } from '#cli/settings/tables.ts';
import type { Session } from '#cli/types/tools.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { buildPathMatcher } from '#cli/system/patterns.ts';
import { CONFIG_FLAG } from '#cli/config/tools/programs.ts';
import type { PlannedCheck } from '#cli/types/engine/plan.ts';
import { findText, readText } from '#cli/system/files/reads.ts';
import { parseCheckedFile } from '#cli/configurations/syntax.ts';
import { runCheckTool } from '#cli/engine/run/tool-runs/tool.ts';
import { listMatchingLines } from '#cli/system/text/positions.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml/parse.ts';
import type { Parsed, SqlNodeFields } from '#cli/types/parsers.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { parseToolOutput } from '#cli/parsers/formats/tool-output.ts';
import { findNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import { SYNTAX_RULE, DENO_CONFIG_FILES } from '#cli/config/configurations/shared.ts';
import type { CheckCode, CheckFinding, CheckSession } from '#cli/types/engine/run.ts';
import { formatOutputTail, assertToolFindings } from '#cli/engine/run/tool-runs/failures.ts';
import { denoLintOutputSchema, supabaseProjectFileSchema } from '#cli/schemas/configurations.ts';
import { readParsedMigrations } from '#cli/configurations/database/postgres/checks/migrations.ts';
import { buildDatabaseSchema } from '#cli/configurations/database/postgres/checks/schema/build.ts';
import type { FunctionEntrypoint, SupabaseProjectFile } from '#cli/types/configurations/platform.ts';

import {
    DENO_CHECK_EXPLANATIONS,
    STORAGE_POLICY_EXPLANATIONS,
} from '#cli/configurations/platform/supabase/explanations.ts';
import {
    DENO_LOCATION,
    SHARED_PREFIX,
    DENO_LINT_NAME,
    VERIFY_JWT_OFF,
    FILE_URL_PREFIX,
    DENO_LINT_COMMAND,
    DENO_CHECK_COMMAND,
    VERIFY_JWT_MESSAGE,
    FUNCTION_ENTRYPOINT,
    DENO_IMPORT_MAP_FLAG,
    STORAGE_POLICY_TABLE,
    SUPABASE_CHECK_RULES,
    SUPABASE_PROJECT_FILE,
    SERVICE_ROLE_KEY_NAMES,
    SERVICE_ROLE_KEY_MESSAGE,
    DENO_CHECK_FAILED_MESSAGE,
} from '#cli/config/configurations/supabase.ts';

function listEqualityBuckets(expression: SqlNodeFields['A_Expr']): string[] {
    for (const [column, value] of [
        [expression.lexpr, expression.rexpr],
        [expression.rexpr, expression.lexpr],
    ]) {
        if (listNodeFields(findNodeFields(column, 'ColumnRef')?.fields, 'String').at(-1)?.sval !== 'bucket_id')
            continue;
        const name = findNodeFields(value, 'A_Const')?.sval?.sval;
        if (name !== undefined) return [name];
    }
    return [];
}

function listMembershipBuckets(expression: SqlNodeFields['A_Expr']): string[] {
    if (listNodeFields(findNodeFields(expression.lexpr, 'ColumnRef')?.fields, 'String').at(-1)?.sval !== 'bucket_id')
        return [];
    let values: Node[] | undefined;
    if (expression.kind === 'AEXPR_IN') values = findNodeFields(expression.rexpr, 'List')?.items;
    else if (expression.kind === 'AEXPR_OP_ANY') values = findNodeFields(expression.rexpr, 'A_ArrayExpr')?.elements;
    return listNodeFields(values, 'A_Const').flatMap((literal) => literal.sval?.sval ?? []);
}

function listBucketConditions(node: Node | undefined): string[] {
    const boolean = findNodeFields(node, 'BoolExpr');
    if (boolean !== undefined) {
        return boolean.boolop === 'NOT_EXPR'
            ? []
            : (boolean.args ?? []).flatMap((child) => listBucketConditions(child));
    }
    const expression = findNodeFields(node, 'A_Expr');
    if (expression === undefined || listNodeFields(expression.name, 'String')[0]?.sval !== '=') return [];
    return expression.kind === 'AEXPR_OP' ? listEqualityBuckets(expression) : listMembershipBuckets(expression);
}

function buildDenoJsonArguments(root: string, folder: string, importMap: string | undefined): string[] {
    const path = DENO_CONFIG_FILES.map((name) => join(root, folder, name)).find(
        (configPath) => statSync(configPath, { throwIfNoEntry: false }) !== undefined,
    );
    if (path !== undefined) return [CONFIG_FLAG, path];
    return importMap === undefined ? [] : [DENO_IMPORT_MAP_FLAG, join(root, importMap)];
}

function normalizeDenoPath(root: string, locator: string): string {
    const path = locator.startsWith(FILE_URL_PREFIX) ? fileURLToPath(locator) : locator;
    const local = convertToPosixPath(relative(root, path));
    return local === '' || !isInside(local) ? path : local;
}

function parseDenoCheckError(session: Session, entrypoint: string, stderr: string): CheckFinding {
    const output = stripVTControlCharacters(stderr);
    const place = DENO_LOCATION.exec(output)?.groups;
    const file = place?.['file'] === undefined ? entrypoint : normalizeDenoPath(session.root, place['file']);
    const first = output.split('\n').find((line) => line.trim() !== '') ?? DENO_CHECK_FAILED_MESSAGE;
    return {
        file,
        line: Number(place?.['line'] ?? 1),
        rule: SUPABASE_CHECK_RULES.typeError,
        message: first.trim(),
    };
}

function readSupabaseProjectFile(
    session: Session,
    planned: PlannedCheck,
): Parsed<SupabaseProjectFile, CheckFinding> | undefined {
    const local = joinScope(planned.scope.path, SUPABASE_PROJECT_FILE);
    const text = findText(session.cache, local);
    return text === undefined
        ? undefined
        : parseCheckedFile(local, () => parseTomlFile(local, text, supabaseProjectFileSchema));
}

function addConfiguredFunctions(
    planned: PlannedCheck,
    functions: NonNullable<SupabaseProjectFile['functions']>,
    entrypoints: Map<string, FunctionEntrypoint>,
): void {
    const base = getTable(planned.scope.settings, 'supabase').functions_folder;
    const configured = Object.entries(functions).filter(([name]) => !name.startsWith(SHARED_PREFIX));
    const projectFolder = posix.dirname(SUPABASE_PROJECT_FILE);
    for (const [name, settings] of configured) {
        const folder = posix.join(base, name);
        const path =
            settings.entrypoint === undefined
                ? entrypoints.get(folder)?.path
                : joinScope(planned.scope.path, posix.join(projectFolder, settings.entrypoint));
        if (path === undefined) continue;
        const importMap =
            settings.import_map === undefined
                ? undefined
                : joinScope(planned.scope.path, posix.join(projectFolder, settings.import_map));
        entrypoints.set(folder, { path, importMap });
    }
}

function listDefaultEntrypoints(planned: PlannedCheck): Map<string, FunctionEntrypoint> {
    const base = getTable(planned.scope.settings, 'supabase').functions_folder;
    const entrypoints = new Map<string, FunctionEntrypoint>();
    for (const { path } of planned.files) {
        const folder = posix.dirname(path);
        if (
            !path.startsWith(`${base}/`) ||
            !FUNCTION_ENTRYPOINT.test(path) ||
            folder.split('/').length !== base.split('/').length + 1 ||
            posix.basename(folder).startsWith(SHARED_PREFIX)
        )
            continue;
        if (!entrypoints.has(folder)) entrypoints.set(folder, { path });
    }
    return entrypoints;
}

function listFunctionEntrypoints(
    planned: PlannedCheck,
    project: SupabaseProjectFile | undefined,
): FunctionEntrypoint[] {
    const base = getTable(planned.scope.settings, 'supabase').functions_folder;
    const entrypoints = listDefaultEntrypoints(planned);
    if (project?.functions !== undefined) addConfiguredFunctions(planned, project.functions, entrypoints);
    if (entrypoints.size === 0) throw new CheckStop('skipped', `No edge function under ${base}.`);
    return entrypoints.values().toArray();
}

async function runDenoFunction(
    session: CheckSession,
    planned: PlannedCheck,
    run: { command: readonly string[]; entrypoint: FunctionEntrypoint; target: string },
) {
    const folder = posix.dirname(run.entrypoint.path);
    const command = [
        ...run.command,
        ...buildDenoJsonArguments(session.root, folder, run.entrypoint.importMap),
        join(session.root, run.target),
    ];
    return runCheckTool(session, planned, command, { cwd: join(session.root, planned.scope.path) });
}

async function checkStoragePolicies(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed === undefined) return [];
    if ('error' in parsed) return [parsed.error];
    const place = { file: joinScope(planned.scope.path, SUPABASE_PROJECT_FILE), line: 1 };
    const migrations = await readParsedMigrations(session, planned);
    const policies = buildDatabaseSchema(migrations).policies.get(STORAGE_POLICY_TABLE)?.values() ?? [];
    const policed = new Set(
        [...policies].flatMap((policy) =>
            [policy.qual, policy.with_check].flatMap((node) => listBucketConditions(node)),
        ),
    );
    return (parsed.value.storage?.buckets === undefined ? [] : Object.keys(parsed.value.storage.buckets))
        .filter((bucket) => !policed.has(bucket))
        .map((bucket) => ({
            ...place,
            rule: SUPABASE_CHECK_RULES.bucketPolicy,
            message: `The bucket ${bucket} has no policy on storage.objects in any migration.`,
        }));
}

async function checkDenoLint(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed !== undefined && 'error' in parsed) return [parsed.error];
    const entrypoints = listFunctionEntrypoints(planned, parsed?.value);
    for (const entrypoint of entrypoints) {
        const result = await runDenoFunction(session, planned, {
            command: DENO_LINT_COMMAND,
            entrypoint,
            target: posix.dirname(entrypoint.path),
        });
        if (result.code !== 0 && result.stdout.trim() === '')
            throw new CheckStop(
                'error',
                formatOutputTail(result, `deno lint stopped with exit ${String(result.code)} and no report.`),
            );
        const report = parseToolOutput(DENO_LINT_NAME, result.stdout, denoLintOutputSchema);
        const broken = report.errors.map((error) => ({
            file: normalizeDenoPath(session.root, error.file_path),
            line: 1,
            rule: SYNTAX_RULE,
            message: error.message,
        }));
        const found = report.diagnostics.map((reported) => ({
            file: normalizeDenoPath(session.root, reported.filename),
            line: reported.range.start.line,
            rule: reported.code,
            message: reported.message,
        }));
        findings.push(...assertToolFindings(result, [...broken, ...found], DENO_LINT_NAME));
    }
    return findings;
}

async function checkDenoCheck(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed !== undefined && 'error' in parsed) return [parsed.error];
    const entrypoints = listFunctionEntrypoints(planned, parsed?.value);
    for (const entrypoint of entrypoints) {
        const result = await runDenoFunction(session, planned, {
            command: DENO_CHECK_COMMAND,
            entrypoint,
            target: entrypoint.path,
        });
        if (result.code !== 0) findings.push(parseDenoCheckError(session, entrypoint.path, result.stderr));
    }
    return findings;
}

function checkServiceRoleKey(session: Session, planned: PlannedCheck): CheckFinding[] {
    const folder = getTable(planned.scope.settings, 'supabase').functions_folder;
    const tests = planned.scope.settings.test_files;
    const isAllowed = buildPathMatcher([`${folder}/**`, ...tests]);
    const files = planned.files.filter((file) => !isAllowed(file.path));
    return files.flatMap((file) =>
        listMatchingLines(readText(session.cache, file.path), (text) =>
            SERVICE_ROLE_KEY_NAMES.some((name) => text.includes(name)),
        ).map((line) => ({
            file: file.path,
            line,
            rule: SUPABASE_CHECK_RULES.serviceRoleKey,
            message: SERVICE_ROLE_KEY_MESSAGE,
        })),
    );
}

function checkVerifyJwt(session: Session, planned: PlannedCheck): CheckFinding[] {
    const file = joinScope(planned.scope.path, SUPABASE_PROJECT_FILE);
    return listMatchingLines(findText(session.cache, file) ?? '', (text) => VERIFY_JWT_OFF.test(text)).map((line) => ({
        file,
        line,
        rule: SUPABASE_CHECK_RULES.verifyJwt,
        message: VERIFY_JWT_MESSAGE,
    }));
}

export const SUPABASE_CHECKS: Readonly<Record<string, CheckCode>> = {
    'supabase/deno-check': { check: checkDenoCheck, explanations: DENO_CHECK_EXPLANATIONS },
    'supabase/deno-lint': { check: checkDenoLint },
    'supabase/service-role-key': { check: checkServiceRoleKey },
    'supabase/storage-policies': { check: checkStoragePolicies, explanations: STORAGE_POLICY_EXPLANATIONS },
    'supabase/verify-jwt': { check: checkVerifyJwt },
};
