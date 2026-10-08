import ts from 'typescript';
import { memo } from '#cli/platform/memo.ts';
import { join, dirname, relative } from 'node:path';
import { ownedInputs } from '#cli/planning/public.ts';
import { parseJsonRecord } from '#cli/parsers/public.ts';
import { readSource } from '#cli/platform/root/public.ts';
import type { PlannedCheck } from '#cli/types/planning.ts';
import { PRIVATE_FILE } from '#cli/config/platform/modes.ts';
import { scopeOf } from '#cli/repository/paths/contracts.ts';
import { getTsconfig } from '#cli/parsers/packages/public.ts';
import { parseBashScript } from '#cli/parsers/bash/public.ts';
import type { ToolSession } from '#cli/types/tools/session.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { ScriptFunction } from '#cli/types/parsers/bash.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { chmodSync, readFileSync, writeFileSync } from 'node:fs';
import { toPosix, extensionOf } from '#cli/platform/contracts.ts';
import { isToolProjectPath } from '#cli/repository/paths/public.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
import { DECLARATION_EXTENSIONS } from '#cli/config/platform/runtime.ts';
import type { ScriptFile, ScriptIndex } from '#cli/types/checks/language/bash.ts';

const SCRIPT_MEMO = { create: () => new Map<string, Promise<ScriptIndex>>() };

async function readScript(input: CheckInput, file: TrackedFile): Promise<ScriptFile> {
    const text = readSource(input.root, file.path, input.reads).toString('utf8');
    const syntax = await parseBashScript(text, {
        minimumStatements: input.view.limit('min_function_statements', 'bash'),
        context: input,
    });
    const references = new Map<string, number[]>();
    for (const call of syntax.calls) {
        const found = references.get(call.name) ?? [];
        found.push(call.line);
        references.set(call.name, found);
    }
    return {
        ...syntax,
        path: file.path,
        text,
        lines: text.split('\n'),
        isExecutable: file.executable,
        references,
    };
}

async function readScriptIndex(input: CheckInput, files: TrackedFile[]): Promise<ScriptIndex> {
    const read: ScriptFile[] = [];
    for (const file of files) read.push(await readScript(input, file));
    const owners = new Map<string, string>();
    for (const file of read)
        for (const entry of file.functions) if (!owners.has(entry.name)) owners.set(entry.name, file.path);
    return { files: read, owners };
}

/**
 * Read the scope's shell index once, sharing syntax data across its checks.
 * @param input the check's scope-owned files and parser resources
 * @returns the index
 */
export function getScriptIndex(input: CheckInput): Promise<ScriptIndex> {
    const files = input.files.filter(
        (file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG) && !isToolProjectPath(file.path),
    );
    const perScope = memo(input.reads, SCRIPT_MEMO);
    const key = JSON.stringify([input.scope, files.map((file) => file.path)]);
    let index = perScope.get(key);
    if (index === undefined) {
        index = readScriptIndex(input, files);
        perScope.set(key, index);
    }
    return index;
}

/**
 * Find the innermost function that contains a source line.
 * @param functions the parsed functions
 * @param line the one-based line
 * @returns the function, or undefined at the top level
 */
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions
        .filter((entry) => entry.start <= line && line <= entry.end)
        .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
}

/**
 * Restrict a disposable JavaScript project to its scope and ambient roots.
 * @param session the repository source inventory
 * @param scratch the disposable copy
 * @param planned the scoped compiler check
 * @param target the generated project path
 * @returns effective options, or undefined for an empty project
 */
export function writeScopeProject(
    session: ToolSession,
    scratch: string,
    planned: PlannedCheck,
    target: string,
): ts.CompilerOptions | undefined {
    if (ownedInputs(session, planned).length === 0) return undefined;
    const scope = planned.scope.scope.path;
    const generatedPath = join(scratch, target);
    const generated = getTsconfig(scratch, generatedPath, {
        root: scratch,
        sources: new Map(),
        memo: new Map(),
    });
    if (generated === undefined) throw new Error(`Missing JavaScript configuration: ${target}`);
    const scopeFiles = generated.fileNames.filter(
        (path) =>
            DECLARATION_EXTENSIONS.includes(extensionOf(path)) ||
            scopeOf(toPosix(relative(scratch, path)), session.repository.scopes).path === scope,
    );
    if (scopeFiles.length === 0) return undefined;
    const authored = parseJsonRecord(readFileSync(generatedPath, 'utf8'));
    // Managed configurations are read-only; only the disposable copy is rewritten.
    chmodSync(generatedPath, PRIVATE_FILE);
    writeFileSync(
        generatedPath,
        JSON.stringify({
            ...authored,
            compilerOptions: {
                ...(authored['compilerOptions'] as Record<string, unknown>),
                typeRoots:
                    ts.getEffectiveTypeRoots(
                        {
                            ...generated.options,
                            configFilePath: join(scratch, scope, 'jsconfig.json'),
                        },
                        {},
                    ) ?? [],
            },
            files: scopeFiles.map((path) => toPosix(relative(dirname(generatedPath), path))),
            include: [],
            exclude: [],
        }),
    );
    return generated.options;
}
