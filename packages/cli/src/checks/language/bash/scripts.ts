import { parseBashScript } from '#cli/parsers/bash.ts';
import { readCachedBytes } from '#cli/system/files/reads.ts';
import { isInGspotFolder } from '#cli/repository/classify.ts';
import { getCachedMapValue } from '#cli/system/files/cache.ts';
import { type ScriptFile } from '#cli/types/checks/language.ts';
import { type CheckInput } from '#cli/types/execution/check.ts';
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
 * Read the scope's shell index once, sharing syntax data across its checks.
 * @param input the check's scope-owned files and parser resources.
 * @returns the index.
 */
export function readScripts(input: CheckInput): Promise<ScriptFile[]> {
    const files = input.files.filter(
        (file) => file.kind === 'source' && file.tags.includes(SCRIPT_TAG) && !isInGspotFolder(file.path),
    );
    const key = JSON.stringify([input.scope.scope.path, files.map((file) => file.path)]);
    return getCachedMapValue(input.reads, SCRIPT_MEMO, key, async () => {
        const scripts: ScriptFile[] = [];
        for (const file of files) scripts.push(await readScript(input, file));
        return scripts;
    });
}

/**
 * Find the innermost function that contains a source line.
 * @param functions the parsed functions.
 * @param line the one-based line.
 * @returns the function, or undefined at the top level.
 */
export function functionAt(functions: ScriptFunction[], line: number): ScriptFunction | undefined {
    return functions
        .filter((entry) => entry.start <= line && line <= entry.end)
        .toSorted((left, right) => left.end - left.start - (right.end - right.start))[0];
}
