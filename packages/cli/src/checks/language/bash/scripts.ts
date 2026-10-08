import { memo } from '#cli/platform/memo.ts';
import { readSource } from '#cli/platform/source.ts';
import { parseBashScript } from '#cli/parsers/bash.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { ScriptFunction } from '#cli/types/parsers/bash.ts';
import { SCRIPT_TAG } from '#cli/config/checks/language/bash.ts';
import { isToolProjectPath } from '#cli/repository/selectors.ts';
import type { TrackedFile } from '#cli/types/repository/inventory.ts';
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
    return { ...syntax, path: file.path, text, lines: text.split('\n'), isExecutable: file.executable, references };
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
