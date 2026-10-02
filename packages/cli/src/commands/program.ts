import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { GspotError } from '#cli/platform/errors.ts';
import { registerList } from '#cli/commands/list.ts';
import { registerApply } from '#cli/commands/apply.ts';
import { registerExport } from '#cli/commands/export.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import type { OutputOptions } from '#cli/types/output.ts';
import { registerInit } from '#cli/commands/init/command.ts';
import { EXIT_ERROR } from '#cli/config/platform/platform.ts';
import { HELP_CODES } from '#cli/config/commands/commands.ts';
import { registerCheck } from '#cli/commands/check/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { registerDoctor } from '#cli/commands/doctor/command.ts';
import { registerExplain } from '#cli/commands/explain/command.ts';
import { registerInstall } from '#cli/commands/install/command.ts';
import type { Program, GlobalFlags } from '#cli/types/commands/commands.ts';
import { Option, Command, CommanderError } from '@commander-js/extra-typings';
import { fail, isColorAllowed, configureOutput } from '#cli/output/messages.ts';

const { version: GSPOT_VERSION } = packageManifest;

// Registration order is shared by help and command lookup.
const COMMAND_REGISTRATIONS: ((program: Program) => void)[] = [
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
    registerExport,
];

// The program reads its options anywhere on the line. It hands the command every argument after the command name,
// its own options included. An option such as --json then also ends a list option of the command where it stands.
class GspotProgram extends Command {
    override parseOptions(argv: string[]): { operands: string[]; unknown: string[] } {
        const parsed = super.parseOptions(argv);
        const [name] = parsed.operands;
        if (name === undefined || !this.commands.some((command) => command.name() === name)) return parsed;
        // The command name is the first argument equal to it that is not the value of an option such as -C.
        const valued = new Set(
            this.options
                .filter((option) => option.required)
                .flatMap((option) => [option.short, option.long])
                .filter((flag) => flag !== undefined),
        );
        const position = argv.findIndex((argument, index) => argument === name && !valued.has(argv[index - 1] ?? ''));
        return { operands: [name], unknown: argv.slice(position + 1) };
    }
}

function verbosityOf(options: GlobalFlags): OutputOptions['verbosity'] {
    if (options.quiet === true) return 'quiet';
    return options.verbose === true ? 'verbose' : 'normal';
}

function exitCodeFor(error: unknown): number {
    if (error instanceof CommanderError) return HELP_CODES.has(error.code) ? 0 : EXIT_ERROR;
    if (error instanceof GspotError && error.code === 'prompt') fail(error.message);
    else fail(`gspot did not run: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT_ERROR;
}

/**
 * Builds the program. Exported so tests can walk it.
 * @returns the commander program with every command registered
 */
export function buildProgram(): Program {
    const program: Program = new GspotProgram('gspot')
        .description('Lint AI-generated code and install rules for coding agents')
        .version(GSPOT_VERSION, '--version', 'Print the version')
        .option('--json', 'Print the result as JSON')
        .option('--quiet', 'Print only failures')
        .option('--verbose', 'Print each command gspot runs, and each ignore with its reason')
        .option('--no-color', 'Print without color')
        .option('-C <dir>', 'Run as if gspot started in this directory')
        .helpOption('-h, --help', 'Print help for the command')
        .helpCommand('help [command]', 'Print help for a command')
        .showSuggestionAfterError(true)
        .showHelpAfterError('(run gspot --help to see every command)')
        .exitOverride();
    program.hook('preAction', () => {
        const options = program.opts();
        configureOutput({
            verbosity: verbosityOf(options),
            json: options.json === true,
            color: isColorAllowed(!options.color),
        });
    });
    for (const register of COMMAND_REGISTRATIONS) register(program);
    // Each command takes hidden copies of the program options, which the program has already read.
    for (const command of program.commands)
        for (const option of program.options.filter((entry) => entry.long !== '--version'))
            command.addOption(new Option(option.flags, option.description).hideHelp());
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
