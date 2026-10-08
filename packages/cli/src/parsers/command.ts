// Reads literal Next.js build flags from native package-script command syntax.
import { parseShell } from '@yarnpkg/parsers';
import type { ShellLine, CommandLine, CommandChain } from '@yarnpkg/parsers';

function* commandSteps(command: CommandChain): Generator<Extract<CommandChain, { type: 'command' }>> {
    switch (command.type) {
        case 'command': {
            yield command;
            break;
        }
        case 'group': {
            yield* scriptCommands(command.group);
            break;
        }
        case 'subshell': {
            yield* scriptCommands(command.subshell);
            break;
        }
        case 'envs': {
            break;
        }
    }
    if (command.then !== undefined) yield* commandSteps(command.then.chain);
}

// Visit native command lines, nested groups, and subshells in shell order.
function* scriptCommands(lines: ShellLine): Generator<Extract<CommandChain, { type: 'command' }>> {
    for (const { command: first } of lines)
        for (let line: CommandLine | undefined = first; line !== undefined; line = line.then?.line)
            yield* commandSteps(line.chain);
}

function nextArguments(
    command: Extract<CommandChain, { type: 'command' }>,
    diagnostic: string,
): (string | undefined)[] {
    const [executable, ...words] = command.args
        .filter((argument) => argument.type === 'argument')
        .map((argument) =>
            argument.segments.every((segment) => segment.type === 'text')
                ? argument.segments.map((segment) => segment.text).join('')
                : undefined,
        );
    if (executable === undefined) throw new Error(diagnostic);
    if (executable === 'next') return words;
    const wrapped =
        ['npx', 'bunx'].includes(executable) ||
        (['npm', 'pnpm', 'yarn', 'bun'].includes(executable) && ['exec', 'dlx', 'next'].includes(words[0] ?? ''));
    if (!wrapped) return [];
    const at = words.indexOf('next');
    return at === -1 ? [] : words.slice(at + 1);
}

/**
 * Read Next.js build flags from a package script without executing its shell commands.
 * @param source the authored package build script
 * @returns the literal flags of its Next.js build command
 */
export function parseNextBuildFlags(source: string): string[] {
    const diagnostic =
        'The Next.js build script has unresolved command or flag expansions. Use literal Next.js build arguments.';
    for (const command of scriptCommands(parseShell(source, { isGlobPattern: () => false }))) {
        const [action, ...flags] = nextArguments(command, diagnostic);
        if (action !== 'build') continue;
        return flags.map((value) => {
            if (value === undefined) throw new Error(diagnostic);
            return value;
        });
    }
    return [];
}
