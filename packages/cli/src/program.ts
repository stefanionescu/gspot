// The commander program: every command from commands/, the global flags, and the run over argv.
import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { registerWhy } from '#cli/commands/why.ts';
import { Command, CommanderError } from 'commander';
import { PromptError } from '#cli/output/prompts.ts';
import { registerInit } from '#cli/commands/init.ts';
import type { OutputOptions } from '#types/output.ts';
import { registerAllow } from '#cli/commands/allow.ts';
import { registerApply } from '#cli/commands/apply.ts';
import { registerCheck } from '#cli/commands/check.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';
import { registerDoctor } from '#cli/commands/doctor.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { registerDeclare } from '#cli/commands/declare.ts';
import { registerExplain } from '#cli/commands/explain.ts';
import { registerUpgrade } from '#cli/commands/upgrade.ts';
import { installCompletion } from '#cli/output/completion.ts';
import { registerUninstall } from '#cli/commands/uninstall.ts';
import { isColorAllowed, configureOutput, fail } from '#cli/output/messages.ts';

const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.version', 'commander.help']);

function verbosityOf(options: Record<string, unknown>): OutputOptions['verbosity'] {
    if (options['quiet'] === true) return 'quiet';
    return options['verbose'] === true ? 'verbose' : 'normal';
}

function exitCodeFor(error: unknown): number {
    if (error instanceof CommanderError) return HELP_CODES.has(error.code) ? 0 : 2;
    if (error instanceof PromptError) fail(error.message);
    else fail(`gspot did not run: ${(error as Error).stack ?? (error as Error).message}`);
    return 2;
}

/**
 * Builds the program. Exported so tests and the completion generator can walk it.
 * @returns the commander program with every command registered
 */
export function buildProgram(): Command {
    const program = new Command('gspot');
    program
        .description(
            'One command that installs the house style for AI-written code: configured linters, the missing rules, and agent instructions',
        )
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
            const directory: unknown = options['C'];
            if (typeof directory === 'string' && directory !== '') options['directory'] = directory;
            configureOutput({
                verbosity: verbosityOf(options),
                json: options['json'] === true,
                color: isColorAllowed(options['color'] === false),
            });
        });
    registerInit(program);
    registerCheck(program);
    registerApply(program);
    registerIgnore(program);
    registerAdd(program);
    registerRemove(program);
    registerAllow(program);
    registerSet(program);
    registerDeclare(program);
    registerWhy(program);
    registerExplain(program);
    registerDoctor(program);
    registerUpgrade(program);
    registerUninstall(program);
    installCompletion(program);
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
