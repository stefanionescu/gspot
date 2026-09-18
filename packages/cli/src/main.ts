// The entry: builds the commander program from commands/ and runs it.
import { Command, CommanderError } from 'commander';

import { registerAdd } from '#cli/commands/add.ts';
import { registerAllow } from '#cli/commands/allow.ts';
import { registerCheck } from '#cli/commands/check.ts';
import { registerCompletion } from '#cli/commands/completion.ts';
import { registerDeclare } from '#cli/commands/declare.ts';
import { registerDoctor } from '#cli/commands/doctor.ts';
import { registerExplain } from '#cli/commands/explain.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerInit } from '#cli/commands/init.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { registerSet } from '#cli/commands/set.ts';
import { registerSync } from '#cli/commands/sync.ts';
import { registerUninstall } from '#cli/commands/uninstall.ts';
import { registerUpgrade } from '#cli/commands/upgrade.ts';
import { registerWhy } from '#cli/commands/why.ts';
import { colorAllowed, configureOutput, fail } from '#cli/output/messages.ts';
import { GSPOT_VERSION } from '#cli/run/version-pin.ts';

/** Builds the program. Exported so tests and the completion generator can walk it. */
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
            const opts = thisCommand.optsWithGlobals() as Record<string, unknown>;
            if (opts['C']) opts['directory'] = opts['C'];
            configureOutput({
                verbosity: opts['quiet'] ? 'quiet' : opts['verbose'] ? 'verbose' : 'normal',
                json: Boolean(opts['json']),
                color: colorAllowed(opts['color'] === false),
            });
        });
    registerInit(program);
    registerCheck(program);
    registerSync(program);
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
    registerCompletion(program);
    return program;
}

/** Runs the program over argv. */
export async function main(argv: string[]): Promise<number> {
    const program = buildProgram();
    try {
        await program.parseAsync(argv, { from: 'user' });
        return Number(process.exitCode ?? 0);
    } catch (error) {
        if (error instanceof CommanderError) {
            if (
                error.code === 'commander.helpDisplayed' ||
                error.code === 'commander.version' ||
                error.code === 'commander.help'
            )
                return 0;
            return 2;
        }
        fail(`gspot did not run: ${(error as Error).stack ?? (error as Error).message}`);
        return 2;
    }
}

if (import.meta.main) {
    process.exitCode = await main(process.argv.slice(2));
}
