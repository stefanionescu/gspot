import { statSync } from 'node:fs';
import type { Node } from '@pgsql/types';
import { fileURLToPath } from 'node:url';
import { join, posix, relative } from 'node:path';
import { getTable } from '#cli/settings/scopes.ts';
import { GspotError } from '#cli/system/errors.ts';
import type { Parsed } from '#cli/types/shapes.ts';
import { stripVTControlCharacters } from 'node:util';
import { joinScope } from '#cli/repository/scopes.ts';
import { find, read } from '#cli/system/files/reads.ts';
import { runCheckTool } from '#cli/runs/command/tool.ts';
import { buildPathMatcher } from '#cli/system/matchers.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { parseTomlFile } from '#cli/parsers/formats/toml.ts';
import type { CheckFinding } from '#cli/types/runs/check.ts';
import { parseToolOutput } from '#cli/parsers/formats/json.ts';
import type { Session, CheckSession } from '#cli/types/session.ts';
import { isInside, convertToPosixPath } from '#cli/system/paths.ts';
import { getNodeFields, listNodeFields } from '#cli/parsers/code/sql.ts';
import { listTaggedExtensions } from '#cli/repository/files/classify.ts';
import { parseCheckedFile } from '#cli/checks/cross-configuration/syntax.ts';
import { SYNTAX_RULE } from '#cli/config/checks/cross-configuration/syntax.ts';
import type { SqlStatement, SqlNodeFields } from '#cli/types/parsers/code/sql.ts';
import { readParsedMigrations } from '#cli/checks/database/postgres/migrations.ts';
import { formatOutputTail, assertToolFindings } from '#cli/runs/command/output.ts';
import type { FunctionEntrypoint, SupabaseProjectFile } from '#cli/types/checks/platform/supabase.ts';
import { denoLintOutputSchema, supabaseProjectFileSchema } from '#cli/schemas/checks/platform/supabase.ts';

import {
    RULES,
    DENO_LOCATION,
    SHARED_PREFIX,
    DENO_LINT_NAME,
    FILE_URL_PREFIX,
    DENO_CONFIG_FLAG,
    DENO_CONFIG_FILES,
    DENO_LINT_COMMAND,
    DENO_CHECK_COMMAND,
    FUNCTION_ENTRYPOINT,
    DENO_IMPORT_MAP_FLAG,
    SERVICE_ROLE_KEY_TAGS,
    SUPABASE_PROJECT_FILE,
    SERVICE_ROLE_KEY_NAMES,
    SERVICE_ROLE_KEY_MESSAGE,
    DENO_CHECK_FAILED_MESSAGE,
    SERVICE_ROLE_KEY_EXTENSIONS,
} from '#cli/config/checks/platform/supabase.ts';

function listEqualityBuckets(expression: SqlNodeFields['A_Expr']): string[] {
    for (const [column, value] of [
        [expression.lexpr, expression.rexpr],
        [expression.rexpr, expression.lexpr],
    ]) {
        if (listNodeFields(getNodeFields(column, 'ColumnRef')?.fields, 'String').at(-1)?.sval !== 'bucket_id') continue;
        const name = getNodeFields(value, 'A_Const')?.sval?.sval;
        if (name !== undefined) return [name];
    }
    return [];
}

function listMembershipBuckets(expression: SqlNodeFields['A_Expr']): string[] {
    if (listNodeFields(getNodeFields(expression.lexpr, 'ColumnRef')?.fields, 'String').at(-1)?.sval !== 'bucket_id')
        return [];
    let values: Node[] | undefined;
    if (expression.kind === 'AEXPR_IN') values = getNodeFields(expression.rexpr, 'List')?.items;
    if (expression.kind === 'AEXPR_OP_ANY') values = getNodeFields(expression.rexpr, 'A_ArrayExpr')?.elements;
    return listNodeFields(values, 'A_Const').flatMap((literal) => literal.sval?.sval ?? []);
}

function listBucketConditions(node: Node | undefined): string[] {
    const boolean = getNodeFields(node, 'BoolExpr');
    if (boolean !== undefined) {
        if (boolean.boolop === 'NOT_EXPR') return [];
        return (boolean.args ?? []).flatMap((child) => listBucketConditions(child));
    }
    const expression = getNodeFields(node, 'A_Expr');
    if (expression === undefined || listNodeFields(expression.name, 'String')[0]?.sval !== '=') return [];
    return expression.kind === 'AEXPR_OP' ? listEqualityBuckets(expression) : listMembershipBuckets(expression);
}

function removePolicies(
    fields: SqlNodeFields['DropStmt'],
    policies: Map<string, SqlNodeFields['CreatePolicyStmt']>,
): void {
    if (fields.removeType !== 'OBJECT_POLICY') return;
    for (const names of listNodeFields(fields.objects, 'List')) {
        const path = listNodeFields(names.items, 'String').map(({ sval }) => sval);
        if (path[0] === 'storage' && path[1] === 'objects' && path[2] !== undefined) policies.delete(path[2]);
    }
}

function updatePolicy(
    statement: SqlStatement<'CreatePolicyStmt' | 'AlterPolicyStmt'>,
    policies: Map<string, SqlNodeFields['CreatePolicyStmt']>,
): void {
    const fields = statement.fields;
    const { table, policy_name: name } = fields;
    if (table?.schemaname !== 'storage' || table.relname !== 'objects' || name === undefined) return;
    if (statement.kind === 'CreatePolicyStmt') policies.set(name, fields);
    else if (policies.has(name)) policies.set(name, { ...policies.get(name), ...fields });
}

function listCoveredBuckets(statements: SqlStatement[]): Set<string> {
    const policies = new Map<string, SqlNodeFields['CreatePolicyStmt']>();
    for (const statement of statements) {
        if (statement.kind === 'DropStmt') removePolicies(statement.fields, policies);
        if (statement.kind === 'CreatePolicyStmt' || statement.kind === 'AlterPolicyStmt')
            updatePolicy(statement, policies);
    }
    return new Set(
        [...policies.values()].flatMap((policy) =>
            [policy.qual, policy.with_check].flatMap((node) => listBucketConditions(node)),
        ),
    );
}

function buildDenoJsonArguments(root: string, folder: string, importMap: string | undefined): string[] {
    const path = DENO_CONFIG_FILES.map((name) => join(root, folder, name)).find(
        (configPath) => statSync(configPath, { throwIfNoEntry: false }) !== undefined,
    );
    if (path !== undefined) return [DENO_CONFIG_FLAG, path];
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
        rule: 'type-error',
        message: first.trim(),
    };
}

function readSupabaseProjectFile(
    session: Session,
    planned: PlannedCheck,
): Parsed<SupabaseProjectFile, CheckFinding> | undefined {
    const local = joinScope(planned.scope.path, SUPABASE_PROJECT_FILE);
    const text = find(session.reads, local);
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
    for (const [name, settings] of Object.entries(functions).filter(([name]) => !name.startsWith(SHARED_PREFIX))) {
        const folder = posix.join(base, name);
        const path =
            settings.entrypoint === undefined
                ? entrypoints.get(folder)?.path
                : joinScope(planned.scope.path, posix.join(posix.dirname(SUPABASE_PROJECT_FILE), settings.entrypoint));
        if (path === undefined) continue;
        const importMap =
            settings.import_map === undefined
                ? undefined
                : joinScope(planned.scope.path, posix.join(posix.dirname(SUPABASE_PROJECT_FILE), settings.import_map));
        entrypoints.set(folder, { path, importMap });
    }
}

function listDefaultEntrypoints(planned: PlannedCheck): Map<string, FunctionEntrypoint> {
    const base = getTable(planned.scope.settings, 'supabase').functions_folder;
    const entrypoints = new Map<string, FunctionEntrypoint>();
    for (const { path } of planned.files) {
        const folder = posix.dirname(path);
        if (
            !path.startsWith(base + '/') ||
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
    if (entrypoints.size === 0) throw new GspotError('skip', `No edge function under ${base}.`);
    return entrypoints.values().toArray();
}

/**
Reports each storage bucket that no migration policy on storage.objects names.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSupabaseStoragePolicies(session: Session, planned: PlannedCheck): Promise<CheckFinding[]> {
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed === undefined) return [];
    if ('error' in parsed) return [parsed.error];
    const place = { file: joinScope(planned.scope.path, SUPABASE_PROJECT_FILE), line: 1 };
    const migrations = await readParsedMigrations(session, planned);
    const policed = listCoveredBuckets(migrations.flatMap((migration) => migration.statements));
    return (parsed.value.storage?.buckets === undefined ? [] : Object.keys(parsed.value.storage.buckets))
        .filter((bucket) => !policed.has(bucket))
        .map((bucket) => ({
            ...place,
            rule: RULES.bucketPolicy,
            message: `The bucket ${bucket} has no policy on storage.objects in any migration.`,
        }));
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

/**
Runs deno lint on each edge function.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSupabaseDenoLint(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed !== undefined && 'error' in parsed) return [parsed.error];
    for (const entrypoint of listFunctionEntrypoints(planned, parsed?.value)) {
        const result = await runDenoFunction(session, planned, {
            command: DENO_LINT_COMMAND,
            entrypoint,
            target: posix.dirname(entrypoint.path),
        });
        if (result.code !== 0 && result.stdout.trim() === '')
            throw new GspotError(
                'check',
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

/**
Reports the first type error of each edge function, from deno check on its entry file.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export async function checkSupabaseDenoCheck(session: CheckSession, planned: PlannedCheck): Promise<CheckFinding[]> {
    const findings: CheckFinding[] = [];
    const parsed = readSupabaseProjectFile(session, planned);
    if (parsed !== undefined && 'error' in parsed) return [parsed.error];
    for (const entrypoint of listFunctionEntrypoints(planned, parsed?.value)) {
        const result = await runDenoFunction(session, planned, {
            command: DENO_CHECK_COMMAND,
            entrypoint,
            target: entrypoint.path,
        });
        if (result.code !== 0) findings.push(parseDenoCheckError(session, entrypoint.path, result.stderr));
    }
    return findings;
}

/**
Reports privileged Supabase keys outside edge functions and test files.

@param session the repository and its tools.
@param planned the configured check and selected scope files.
*/
export function checkSupabaseServiceRoleKey(session: Session, planned: PlannedCheck): CheckFinding[] {
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
        read(session.reads, file.path)
            .split('\n')
            .flatMap((text, index): CheckFinding[] => {
                if (!SERVICE_ROLE_KEY_NAMES.some((name) => text.includes(name))) return [];
                const message = SERVICE_ROLE_KEY_MESSAGE;
                return [
                    {
                        file: file.path,
                        line: index + 1,
                        rule: RULES.serviceRoleKey,
                        message: message,
                    },
                ];
            }),
    );
}
