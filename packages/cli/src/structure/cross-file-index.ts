// The shell scripts of one scope, read once per run: functions, references and top-level assignments, and who owns each function.
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import type { EngineInput } from '#cli/run/types.ts';
import type { TrackedFile } from '#cli/repository/types.ts';
import { TOP_LEVEL_ASSIGNMENT } from '#cli/structure/structure-definitions.ts';
import { functionAt, scriptFunctions } from '#cli/structure/parser.ts';
import { withoutComment, withoutDeclaration } from '#cli/structure/code-lines.ts';
import type { ScriptFile, ScriptFunction, ScriptIndex } from '#cli/structure/types.ts';

const IDENTIFIER = /[A-Za-z_]\w*/gu;
const cache = new WeakMap<object, Map<string, Promise<ScriptIndex>>>();

function referencesOf(lines: string[], functions: ScriptFunction[]): Map<string, number[]> {
    const references = new Map<string, number[]>();
    const declarations = new Set(functions.map((entry) => entry.start));
    for (const [index, line] of lines.entries()) {
        const number = index + 1;
        if (declarations.has(number)) continue;
        for (const match of withoutComment(line).matchAll(IDENTIFIER)) {
            const found = references.get(match[0]) ?? [];
            found.push(number);
            references.set(match[0], found);
        }
    }
    return references;
}

function assignmentsOf(lines: string[], functions: ScriptFunction[]): Set<string> {
    const names = new Set<string>();
    for (const [index, line] of lines.entries()) {
        if (functionAt(functions, index + 1) !== undefined) continue;
        const code = withoutDeclaration(withoutComment(line).trim());
        const name = TOP_LEVEL_ASSIGNMENT.exec(code)?.groups?.['name'];
        if (name !== undefined) names.add(name);
    }
    return names;
}

async function readScriptFile(root: string, file: TrackedFile): Promise<ScriptFile> {
    const text = readFileSync(join(root, file.path), 'utf8');
    const lines = text.split('\n');
    const functions = await scriptFunctions(text);
    return {
        path: file.path,
        text,
        lines,
        functions,
        isExecutable: file.executable,
        references: referencesOf(lines, functions),
        assignments: assignmentsOf(lines, functions),
    };
}

async function build(input: EngineInput, files: TrackedFile[]): Promise<ScriptIndex> {
    const read: ScriptFile[] = [];
    for (const file of files) read.push(await readScriptFile(input.root, file));
    const owners = new Map<string, string>();
    for (const file of read)
        for (const entry of file.functions) if (!owners.has(entry.name)) owners.set(entry.name, file.path);
    return { files: read, owners };
}

/**
 * The shell index of a scope, built on first use and shared by every analysis of the run.
 * @param input the engine input
 * @param files the shell files the check runs over
 * @returns the index
 */
export function scriptIndex(input: EngineInput, files: TrackedFile[]): Promise<ScriptIndex> {
    let perScope = cache.get(input.session);
    if (perScope === undefined) {
        perScope = new Map();
        cache.set(input.session, perScope);
    }
    const key = `${input.scope}\n${files.map((file) => file.path).join('\n')}`;
    let index = perScope.get(key);
    if (index === undefined) {
        index = build(input, files);
        perScope.set(key, index);
    }
    return index;
}

/**
 * The files other than the owner that reference a name.
 * @param index the index
 * @param name the function name
 * @param owner the owner's path
 * @returns the other paths, sorted
 */
export function outsideCallers(index: ScriptIndex, name: string, owner: string): string[] {
    return index.files
        .filter((file) => file.path !== owner && (file.references.get(name)?.length ?? 0) > 0)
        .map((file) => file.path)
        .toSorted((a, b) => a.localeCompare(b));
}
