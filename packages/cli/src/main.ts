import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { findRoot } from '#cli/repository/read.ts';
import { registerList } from '#cli/commands/list.ts';
import { Command } from '@commander-js/extra-typings';
import { registerApply } from '#cli/commands/apply.ts';
import { registerUnset } from '#cli/commands/unset.ts';
import { registerExport } from '#cli/commands/export.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { assertVersionPin } from '#cli/apply/version-pin.ts';
import { registerInit } from '#cli/commands/init/command.ts';
import { registerUnignore } from '#cli/commands/unignore.ts';
import { registerCheck } from '#cli/commands/check/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { registerDoctor } from '#cli/commands/doctor/command.ts';
import { registerExplain } from '#cli/commands/explain/command.ts';
import { registerInstall } from '#cli/commands/install/command.ts';
import { VERSION_PIN_COMMANDS } from '#cli/config/commands/program.ts';
import { COMMAND_HELP, PROGRAM_HELP } from '#cli/config/commands/help.ts';
import { PROCESS_ARGUMENTS_START } from '#cli/config/system/processes.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { printResult, printFailure, isColorAllowed, setOutputOptions } from '#cli/system/terminal.ts';

if (import.meta.main) process.exitCode = await runProgram(process.argv.slice(PROCESS_ARGUMENTS_START));

/**
 * Build the CLI with every command. Runs and the command reference both use it.
 * @param onResult writes the command result.
 * @returns the Commander program.
 */
function buildProgram(onResult: CommandCompletion): Command {
    const program: Command = new Command('gspot')
        .description('Lint AI-generated code and write rules for AI coding agents.')
        .version(packageManifest.version, '--version', 'Print the version')
        .helpOption('-h, --help', 'Print help for the command')
        .helpCommand(false)
        .showSuggestionAfterError(true)
        .showHelpAfterError('(add --help to see the options)')
        .exitOverride();
    program.configureOutput({ writeErr: () => {} });
    registerInit(program, onResult);
    registerInstall(program, onResult);
    registerApply(program, onResult);
    registerCheck(program, onResult);
    registerAdd(program, onResult);
    registerRemove(program, onResult);
    registerSet(program, onResult);
    registerUnset(program, onResult);
    registerIgnore(program, onResult);
    registerUnignore(program, onResult);
    registerList(program, onResult);
    registerExplain(program, onResult);
    registerDoctor(program, onResult);
    registerExport(program, onResult);
    for (const command of program.commands) {
        const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
        command.helpGroup(help.group);
        command.helpOption('-h, --help', help.options['-h, --help']);
        command.option('--json', help.options['--json']);
        command.addHelpText('after', `\nExit codes:\n${help.exitCodes}\n\nExample:\n  ${help.example}\n`);
    }
    program.configureHelp({ formatHelp: () => PROGRAM_HELP });
    return program;
}

/**
 * Run the CLI with the arguments.
 * @param commandArguments the arguments after the program name.
 * @returns the exit code.
 */
async function runProgram(commandArguments: string[]): Promise<number> {
    let result!: CommandResult;
    const program = buildProgram((value) => {
        result = value;
    });
    const commandJson = commandArguments.includes('--json');
    setOutputOptions({ json: commandJson, color: isColorAllowed() });
    program.hook('preAction', async (_program, command) => {
        if (
            VERSION_PIN_COMMANDS.has(command.name()) ||
            (command.name() === 'check' && command.getOptionValue('fix') === true)
        )
            await assertVersionPin(findRoot(process.cwd()));
    });
    try {
        await program.parseAsync(commandArguments, { from: 'user' });
        printResult(result);
        return result.exitCode;
    } catch (error) {
        return printFailure(error, { json: commandJson });
    }
}
export { runProgram, buildProgram };
