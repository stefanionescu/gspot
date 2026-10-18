import { parseBashScript } from '#cli/parsers/bash.ts';
import { type CheckInput } from '#cli/types/runs/check.ts';
import { type ScriptFile } from '#cli/types/checks/bash.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { SCRIPT_TAG } from '#cli/config/repository/inventory.ts';
import { type ScriptFunction } from '#cli/types/parsers/bash.ts';
import { type TrackedFile } from '#cli/types/repository/inventory.ts';

const SCRIPT_MEMO = { create: () => new Map<string, Promise<ScriptFile[]>>() };

async function readScript(input: CheckInput, file: TrackedFile): Promise<ScriptFile> {
    const text = readCachedBytes(input.reads, file.path).toString('utf8');
    const syntax = await parseBashScript(text, input);
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

/**
 * Parses the scope scripts once and shares them across checks.
 * @param input the scope files and parser resources.
 * @returns the parsed scripts.
 */
export function readScripts(input: CheckInput): Promise<ScriptFile[]> {
    const files = input.files.filter(
        (file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG) && !isInGspotFolder(file.path),
    );
    const key = JSON.stringify([input.selection.scope.path, files.map((file) => file.path)]);
    return getCachedMapValue(input.reads, SCRIPT_MEMO, key, async () => {
        const scripts: ScriptFile[] = [];
        for (const file of files) scripts.push(await readScript(input, file));
        return scripts;
    });
}

/**
 * Finds the innermost function that holds a line.
 * @param functions the parsed definitions.
 * @param line the number, counted from one.
 * @returns the function, or undefined at the top level.
 */
export function findFunctionAtLine(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions
        .filter((entry) => entry.start <= line && line <= entry.end)
        .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
}
