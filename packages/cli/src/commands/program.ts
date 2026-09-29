import { registerSet } from '#cli/commands/set.ts';
import { Command, CommanderError } from 'commander';
import { GspotError } from '#cli/platform/errors.ts';
import { registerList } from '#cli/commands/list.ts';
import { registerExport } from '#cli/commands/export.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import type { OutputOptions } from '#cli/types/output.ts';
import { registerInstall } from '#cli/commands/install.ts';
import packageManifest from '#package' with { type: 'json' };
import { registerInit } from '#cli/commands/init/command.ts';
import { registerApply } from '#cli/commands/apply/command.ts';
import { registerCheck } from '#cli/commands/check/command.ts';
import { registerUninstall } from '#cli/commands/uninstall.ts';
import { installCompletion } from '#cli/commands/completion.ts';
import { registerDoctor } from '#cli/commands/doctor/command.ts';
import { registerExplain } from '#cli/commands/explain/command.ts';
import { registerAdd, registerRemove } from '#cli/commands/kits.ts';
import { ERROR_EXIT, HELP_CODES } from '#cli/config/commands/commands.ts';
import { fail, isColorAllowed, configureOutput } from '#cli/output/messages.ts';

const { version: GSPOT_VERSION } = packageManifest;

// Registration order is shared by help, command lookup, and completion.
const COMMAND_REGISTRATIONS: ((program: Command) => void)[] = [
    registerInit,
    registerInstall,
    registerCheck,
    registerApply,
    registerIgnore,
    registerAdd,
    registerRemove,
    registerSet,
    registerExplain,
    registerDoctor,
    registerList,
    registerUninstall,
    registerExport,
    installCompletion,
];

function verbosityOf(options: Record<string, unknown>): OutputOptions['verbosity'] {
    if (options['quiet'] === true) return 'quiet';
    return options['verbose'] === true ? 'verbose' : 'normal';
}

function exitCodeFor(error: unknown): number {
    if (error instanceof CommanderError) return HELP_CODES.has(error.code) ? 0 : ERROR_EXIT;
    if (error instanceof GspotError && error.code === 'prompt') fail(error.message);
    else fail(`gspot did not run: ${error instanceof Error ? error.message : String(error)}`);
    return ERROR_EXIT;
}

/**
 * Builds the program. Exported so tests and the completion generator can walk it.
 * @returns the commander program with every command registered
 */
export function buildProgram(): Command {
    const program = new Command('gspot');
    program
        .description('CLI to lint and enforce rules for LLM generated codebases')
        .version(GSPOT_VERSION, '--version', 'Print the version and nothing else')
        .option('--json', 'Print the documented JSON object instead of text')
        .option('--quiet', 'Print failures only')
        .option('--verbose', 'Print every command with its arguments and every ignore with its reason')
        .option('--no-color', 'No color in the output')
        .option('-C <dir>', 'Run as if started in that directory')
        .showSuggestionAfterError(true)
        .showHelpAfterError('(run gspot --help to see every command)')
        .exitOverride()
        .hook('preAction', (thisCommand) => {
            const options = thisCommand.optsWithGlobals();
            configureOutput({
                verbosity: verbosityOf(options),
                json: options['json'] === true,
                color: isColorAllowed(options['color'] === false),
            });
        });
    for (const register of COMMAND_REGISTRATIONS) register(program);
    return program;
}

/**
 * Runs the program over argv.
 * @param argv the arguments after the program name
 * @returns the exit code
 */
export async function main(argv: string[]): Promise<number> {
    const program = buildProgram();
    try {
        await program.parseAsync(argv, { from: 'user' });
        return Number(process.exitCode ?? 0);
    } catch (error) {
        return exitCodeFor(error);
    }
}
