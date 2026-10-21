import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { findRoot } from '#cli/repository/read.ts';
import { registerList } from '#cli/commands/list.ts';
import { registerApply } from '#cli/commands/apply.ts';
import { registerUnset } from '#cli/commands/unset.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { registerInstall } from '#cli/commands/install.ts';
import { registerInit } from '#cli/commands/init/command.ts';
import { registerUnignore } from '#cli/commands/unignore.ts';
import { assertVersionPin } from '#cli/repository/version.ts';
import { registerCheck } from '#cli/commands/check/command.ts';
import packageManifest from '#cli-package' with { type: 'json' };
import { registerDoctor } from '#cli/commands/doctor/command.ts';
import { registerExplain } from '#cli/commands/explain/command.ts';
import { Command, type Argument } from '@commander-js/extra-typings';
import { VERSION_PIN_COMMANDS } from '#cli/config/commands/program.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { printResult, printFailure, isColorAllowed, setOutputOptions } from '#cli/system/terminal.ts';

import {
    CODE_MARK,
    COMMAND_HELP,
    GLOBAL_OPTIONS,
    HELP_TERM_WIDTH,
    EXIT_CODE_SPACING,
    PROGRAM_EXIT_CODES,
    PROGRAM_HELP_FOOTER,
} from '#cli/config/commands/help.ts';

function formatArgumentTerm(argument: Argument): string {
    const name = argument.argChoices?.join('|') ?? argument.name();
    const shown = argument.variadic ? `${name}...` : name;
    return argument.required ? `<${shown}>` : `[${shown}]`;
}

/**
 * Align exit code rows for terminal help.
 *
 * @param rows the codes and their meanings
 * @returns one aligned line for each row
 */
function formatExitCodes(rows: readonly (readonly [codes: string, meaning: string])[]): string {
    const width = Math.max(...rows.map(([codes]) => codes.length)) + EXIT_CODE_SPACING;
    return rows.map(([codes, meaning]) => `  ${codes.padEnd(width)}${meaning}`).join('\n');
}

/**
 * Build the help of gspot from its commands: their groups, arguments, and summaries, then the fixed footer.
 *
 * @param program the CLI with every command.
 * @returns the help text.
 */
function formatProgramHelp(program: Command): string {
    const groups = new Map<string, string[]>();
    for (const command of program.commands) {
        const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
        const term = [
            command.name(),
            ...command.registeredArguments.map((argument) => formatArgumentTerm(argument)),
        ].join(' ');
        const row =
            term.length < HELP_TERM_WIDTH
                ? `  ${term.padEnd(HELP_TERM_WIDTH)}${help.summary}`
                : `  ${term}  ${help.summary}`;
        groups.set(help.group, [...(groups.get(help.group) ?? []), row]);
    }
    const sections = [...groups].map(([group, rows]) => `${group}\n${rows.join('\n')}`);
    return `Usage: gspot <command> [options]\n\n${program.description()}\n\n${sections.join('\n\n')}\n\nOptions:\n${Object.entries(
        GLOBAL_OPTIONS,
    )
        .map(([flags, description]) => `  ${flags.padEnd(HELP_TERM_WIDTH)}${description}`)
        .join('\n')}\n\nExit codes:\n${formatExitCodes(PROGRAM_EXIT_CODES)}\n\n${PROGRAM_HELP_FOOTER}`;
}

/**
 * Build the CLI with every command. Runs and the command reference both use it.
 *
 * @param onResult writes the command result.
 * @returns the Commander program.
 */
function buildProgram(onResult: CommandCompletion): Command {
    const program: Command = new Command('gspot')
        .description(packageManifest.description)
        .version(packageManifest.version, '--version', GLOBAL_OPTIONS['--version'])
        .helpOption('-h, --help', GLOBAL_OPTIONS['-h, --help'])
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
    for (const command of program.commands) {
        const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
        command.helpGroup(help.group);
        command.helpOption('-h, --help', GLOBAL_OPTIONS['-h, --help']);
        command.option('--json', help.options['--json']);
        command.addHelpText(
            'after',
            `\nExit codes:\n${formatExitCodes(help.exitCodes)}\n\nExample:\n  ${help.example}\n`,
        );
        // The help text marks code for the reference pages; the terminal prints it without the marks.
        command.configureHelp({ styleDescriptionText: (text) => text.replaceAll(CODE_MARK, '') });
    }
    program.configureHelp({ formatHelp: () => formatProgramHelp(program) });
    return program;
}

/**
 * Run the CLI with the arguments.
 *
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
        return printFailure(error, formatProgramHelp(program));
    }
}
export { runProgram, buildProgram };
