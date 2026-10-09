import { join, posix } from 'node:path';
import { findingAt } from '#cli/checks/finding.ts';
import { readSource } from '#cli/platform/root/public.ts';
import { globPaths } from '#cli/platform/root/contracts.ts';
import type { Finding } from '#cli/types/parsers/output.ts';
import { DOT_GSPOT } from '#cli/config/platform/locations.ts';
import { pathMatcher } from '#cli/repository/paths/public.ts';
import { runCheckTool } from '#cli/execution/command/public.ts';
import { copyIntoScratch } from '#cli/execution/copy/public.ts';
import type { CheckInput } from '#cli/types/execution/check.ts';
import type { CommandPart } from '#cli/types/execution/command.ts';
import { SCRATCH_DIRECTORIES } from '#cli/config/execution/copy.ts';
import { toolOutputDetail } from '#cli/execution/command/contracts.ts';
import type { GeneratedPath } from '#cli/types/checks/general/generated-code.ts';
import { substitute, perFileCommands, substituteValue } from '#cli/execution/command/arguments/public.ts';

function missingOutputs(input: CheckInput, targets: GeneratedPath[], command: CommandPart[]): Finding[] {
    const entry = targets.find((target) => {
        try {
            readSource(input.root, target.path, input.reads);
            return false;
        } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return true;
            throw error;
        }
    });
    if (entry === undefined) return [];
    if (entry.kind === 'stdout')
        return [
            findingAt(
                input,
                { file: entry.path, line: 1 },
                'missing',
                `Run ${command.filter((part) => typeof part === 'string').join(' ')} and write its output to ${entry.path}.`,
            ),
        ];
    const setting = entry.original.slice('{setting:'.length, -1);
    throw new Error(`The ${setting} setting names ${entry.path}, which does not exist.`);
}

// Both snapshots use the same native traversal and source containment boundary.
function copiedFiles(root: string, scope: string, paths: GeneratedPath[]): Map<string, Buffer> {
    const cwd = join(root, scope);
    const patterns = paths.filter((entry) => entry.kind === 'pattern').map((entry) => entry.path);
    const excluded = [...SCRATCH_DIRECTORIES, DOT_GSPOT].map((name) => `!**/${name}/**`);
    return new Map([
        ...globPaths(cwd, [...patterns, ...excluded], { dot: true }).map((path): [string, Buffer] => [
            posix.join(scope, path),
            readSource(cwd, path),
        ]),
        ...paths
            .filter((entry) => entry.kind !== 'pattern')
            .map((entry): [string, Buffer] => [entry.path, readSource(root, entry.path)]),
    ]);
}

function generatedInputs(input: CheckInput) {
    const planned = {
        check: input.check,
        scope: input.selection,
        files: input.files,
        manifest: input.selection.selected.find((manifest) => manifest.checks.includes(input.check)),
    };
    const values = {
        root: input.root,
        scope: input.scope,
        files: [],
        indent: input.view.format.indent_style === 'space' ? input.view.format.indent_width : 0,
    };
    const declaration = input.check.command ?? [];
    const command = substitute(input, planned, declaration, values);

    const declared = (input.check.generated_paths ?? []).flatMap((entry): GeneratedPath[] => {
        const { kind, path: original } = entry;
        const path = substituteValue(input, planned, original, values);
        return path === '' ? [] : [{ kind, path, original }];
    });

    const patterns = declared.filter((entry) => entry.kind === 'pattern').map((entry) => entry.path);
    const isMatched = pathMatcher(patterns);
    const selected = input.files
        .map((file) => posix.relative(input.scope, file.path))
        .filter((path) => isMatched(path));

    if (command.length === 0 || declared.length === 0) return undefined;
    if (declared.every((entry) => entry.kind === 'pattern') && selected.length === 0) return undefined;
    return { planned, values, command, declaration, declared, selected };
}

/**
 * Run the declared generator in a private copy and compare its native outputs.
 * @param input the selected generator and project scope
 * @returns located missing or stale generated paths
 */
export async function generatedCode(input: CheckInput): Promise<Finding[]> {
    if (input.cancelSignal?.aborted === true) throw new Error('The command was canceled.');
    const inputs = generatedInputs(input);
    if (inputs === undefined) return [];
    const { planned, values, command, declaration, declared, selected } = inputs;
    const targets = declared.filter((entry) => entry.kind !== 'pattern');
    const missing = missingOutputs(input, targets, command);
    if (missing.length > 0) return missing;
    using folder = await copyIntoScratch(
        input,
        targets.map((entry) => entry.path),
    );
    const cwd = join(folder.path, input.scope);
    const before = copiedFiles(folder.path, input.scope, declared);
    const argv = substitute({ ...input, root: folder.path }, planned, declaration, {
        ...values,
        root: folder.path,
    });
    const commands = perFileCommands(argv, selected);
    let stdout = '';
    for (const invocation of commands) {
        const result = await runCheckTool(input, invocation.argv, { cwd });
        if (result.code !== 0)
            throw new Error(
                `The generator command failed: ${toolOutputDetail(result, 'The tool printed no diagnostic.')}`,
            );
        stdout = result.stdout;
    }
    const after = copiedFiles(folder.path, input.scope, declared);
    for (const entry of targets.filter((entry) => entry.kind === 'stdout'))
        after.set(entry.path, Buffer.from(stdout.trim()));
    const trimmed = new Set(targets.filter((entry) => entry.kind === 'stdout').map((entry) => entry.path));
    return [...new Set([...before.keys(), ...after.keys()])]
        .filter((path) => {
            const was = before.get(path);
            const now = after.get(path);
            return (
                was === undefined ||
                now === undefined ||
                (trimmed.has(path) ? was.toString('utf8').trim() !== now.toString('utf8') : !was.equals(now))
            );
        })
        .toSorted((left, right) => left.localeCompare(right))
        .map((path) =>
            findingAt(
                input,
                { file: path, line: 1 },
                'stale',
                `Running ${JSON.stringify(command)} changes this generated file; commit what it writes.`,
            ),
        );
}
