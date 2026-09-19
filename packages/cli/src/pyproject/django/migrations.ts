import { readFileSync } from 'node:fs';
import type { EngineInput } from '#types/run.ts';
import type { Finding } from '#types/finding.ts';
// The Django checks that read migration files: a name Django generated, and an operation with no way back.
import { basename, dirname, join } from 'node:path';

const AUTO_NAME = /^\d+_auto_\d+/u;
const KEYWORD_ARGUMENT = /^[a-z_]+\s*=(?!=)/u;
const OPERATION = /migrations\.(?<kind>RunPython|RunSQL)\(/gu;
const OPENERS = '([{';
const CLOSERS = ')]}';

function finding(input: EngineInput, at: { file: string; line: number }, rule: string, text: string): Finding {
    return { check: input.spec.id, file: at.file, line: at.line, rule, message: text, fixable: false };
}

function migrations(input: EngineInput): string[] {
    return input.files
        .filter((file) => file.nature === 'source' && file.path.endsWith('.py'))
        .map((file) => file.path)
        .filter((path) => basename(dirname(path)) === 'migrations' && basename(path) !== '__init__.py');
}

function depthChange(character: string): number {
    if (OPENERS.includes(character)) return 1;
    return CLOSERS.includes(character) ? -1 : 0;
}

// The text of one call, from its opening bracket to the bracket that closes it.
function callText(text: string, from: number): string {
    let depth = 0;
    for (let index = from; index < text.length; index += 1) {
        depth += depthChange(text[index] ?? '');
        if (depth === 0) return text.slice(from, index + 1);
    }
    return text.slice(from);
}

// The arguments of a call, split at the commas that sit inside no bracket.
function topLevelArguments(call: string): string[] {
    const inside = call.slice(1, -1);
    const cuts: number[] = [];
    let depth = 0;
    for (let index = 0; index < inside.length; index += 1) {
        const character = inside.charAt(index);
        depth += depthChange(character);
        if (character === ',' && depth === 0) cuts.push(index);
    }
    const edges = [-1, ...cuts, inside.length];
    return edges
        .slice(1)
        .map((edge, index) => inside.slice((edges[index] ?? -1) + 1, edge).trim())
        .filter((part) => part !== '');
}

// RunPython and RunSQL take the way forward first and the way back second, by position or by keyword.
function hasWayBack(kind: string, call: string): boolean {
    const keyword = kind === 'RunPython' ? 'reverse_code' : 'reverse_sql';
    const given = topLevelArguments(call);
    if (given.some((part) => part.startsWith(`${keyword}=`) || part.startsWith(`${keyword} =`))) return true;
    return given.filter((part) => !KEYWORD_ARGUMENT.test(part)).length > 1;
}

function operationProblems(input: EngineInput, path: string): Finding[] {
    const text = readFileSync(join(input.root, path), 'utf8');
    return text
        .matchAll(OPERATION)
        .flatMap((match): Finding[] => {
            const kind = match.groups?.['kind'] ?? '';
            const open = match.index + match[0].length - 1;
            if (hasWayBack(kind, callText(text, open))) return [];
            const line = text.slice(0, match.index).split('\n').length;
            const keyword = kind === 'RunPython' ? 'reverse_code' : 'reverse_sql';
            const said = `This ${kind} names no ${keyword}, so the migration cannot be undone.`;
            return [finding(input, { file: path, line }, 'no-way-back', said)];
        })
        .toArray();
}

/**
 * One finding for each migration that keeps the name Django generated.
 * @param input the engine input
 * @returns the findings
 */
export function djangoMigrationNames(input: EngineInput): Promise<Finding[]> {
    const said = 'This migration keeps the name Django gave it. Name it for what it does.';
    const found = migrations(input)
        .filter((path) => AUTO_NAME.test(basename(path)))
        .map((path) => finding(input, { file: path, line: 1 }, 'auto-name', said));
    return Promise.resolve(found);
}

/**
 * One finding for each RunPython and RunSQL that names no way back.
 * @param input the engine input
 * @returns the findings
 */
export function djangoMigrationReversible(input: EngineInput): Promise<Finding[]> {
    return Promise.resolve(migrations(input).flatMap((path) => operationProblems(input, path)));
}
