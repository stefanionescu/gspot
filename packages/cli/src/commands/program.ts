import { GspotError } from '#cli/errors.ts';
import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { registerList } from '#cli/commands/list.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { registerApply } from '#cli/commands/apply.ts';
import { registerUnset } from '#cli/commands/unset.ts';
import { registerExport } from '#cli/commands/export.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { registerInstall } from '#cli/commands/install.ts';
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { registerInit } from '#cli/commands/init/command.ts';
import { registerUnignore } from '#cli/commands/unignore.ts';
import { registerCheck } from '#cli/commands/check/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { registerDoctor } from '#cli/commands/doctor/command.ts';
import { registerExplain } from '#cli/commands/explain/command.ts';
import { Command, CommanderError } from '@commander-js/extra-typings';
import { printError, isColorAllowed, configureOutput } from '#cli/terminal/print.ts';

function printFailure(error: unknown, isJson: boolean): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        if (isJson) {
            printError({ error: 'arguments', message: error.message });
        }
        return EXIT_ERROR;
    }
    if (error instanceof GspotError) {
        printError({ error: error.code, message: error.message });
        return EXIT_ERROR;
    }
    const detail = (error instanceof Error ? error.message : String(error)).replaceAll(/\s+/gu, ' ').trim();
    const message = `gspot stopped because of an internal error: ${detail}. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.`;
    printError(isJson ? { error: 'failure', message } : message);
    return EXIT_ERROR;
}

/**
 * Build the registered CLI program used by execution and the generated command reference.
 * @returns the commander program with every command registered
 */
function buildProgram(): Command {
    const program: Command = new Command('gspot')
        .description('Lint AI-generated code and write rules for AI coding agents.')
        .version(packageManifest.version, '--version', 'Print the version')
        .helpOption('-h, --help', 'Print help for the command')
        .helpCommand(false)
        .showSuggestionAfterError(true)
        .showHelpAfterError('(add --help to see the options)')
        .exitOverride();
    program.configureOutput({ writeErr: (text) => process.stderr.write(text) });
    program.hook('preAction', (_program, command) => {
        const options = command.opts();
        configureOutput({
            json: options['json'] === true,
            color: isColorAllowed(),
        });
    });
    registerInit(program);
    registerInstall(program);
    registerApply(program);
    registerCheck(program);
    registerAdd(program);
    registerRemove(program);
    registerSet(program);
    registerUnset(program);
    registerIgnore(program);
    registerUnignore(program);
    registerList(program);
    registerExplain(program);
    registerDoctor(program);
    registerExport(program);
    for (const command of program.commands) {
        const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
        command.helpOption('-h, --help', help.options['-h, --help']);
        command.option('--json', help.options['--json']);
        command.addHelpText('after', commandHelp(help));
    }
    return program;
}

/**
 * Runs the program over argv.
 * @param argv the arguments after the program name
 * @returns the exit code
 */
async function main(argv: string[]): Promise<number> {
    const program = buildProgram();
    const commandJson = argv.includes('--json');
    if (commandJson)
        for (const command of [program, ...program.commands]) command.configureOutput({ writeErr: () => {} });
    try {
        await program.parseAsync(argv, { from: 'user' });
        return Number(process.exitCode ?? 0);
    } catch (error) {
        const isJson = commandJson;
        configureOutput({ json: isJson, color: isColorAllowed() });
        if (isJson && error instanceof CommanderError && error.code === 'commander.help')
            return printFailure(new GspotError('arguments', 'Name a command. Run gspot --help to see them.'), isJson);
        return printFailure(error, isJson);
    }
}

/**
 * Build the shared exit codes and example footer for each command.
 * @param help the command's fixed help record
 * @returns the command footer
 */
function commandHelp(help: (typeof COMMAND_HELP)[keyof typeof COMMAND_HELP]): string {
    return `\nExit codes:\n${help.exitCodes}\n\nExample:\n${help.example}\n`;
}

export { main, buildProgram };
