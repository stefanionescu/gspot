import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { GspotError } from '#cli/system/errors.ts';
import { registerList } from '#cli/commands/list.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
import { isGitRepository } from '#cli/system/git.ts';
import { registerApply } from '#cli/commands/apply.ts';
import { registerUnset } from '#cli/commands/unset.ts';
import { registerIgnore } from '#cli/commands/ignore.ts';
import { registerRemove } from '#cli/commands/remove.ts';
import { registerInit } from '#cli/commands/init/init.ts';
import { registerInstall } from '#cli/commands/install.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { COMMAND_HELP } from '#cli/config/commands/help.ts';
import { registerCheck } from '#cli/commands/check/check.ts';
import { registerUnignore } from '#cli/commands/unignore.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { registerDoctor } from '#cli/commands/doctor/doctor.ts';
import { assertVersionPin } from '#cli/repository/version-pin.ts';
import { registerExplain } from '#cli/commands/explain/explain.ts';
import { readEnvironmentVariable } from '#cli/system/environment.ts';
import { WHITESPACE_RUN, TRAILING_PERIOD } from '#cli/config/text.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { printError, printResult, setOutputOptions } from '#cli/system/terminal.ts';
import { Command, type Argument, CommanderError } from '@commander-js/extra-typings';

import {
    HELP_FLAG,
    CODE_MARK,
    USAGE_LINE,
    GIT_COMMANDS,
    GLOBAL_OPTIONS,
    HELP_ERROR_CODE,
    HELP_TERM_WIDTH,
    NEEDS_GIT_MESSAGE,
    EXIT_CODE_SPACING,
    COMMAND_SUGGESTION,
    PROGRAM_EXIT_CODES,
    PROGRAM_HELP_FOOTER,
    VERSION_PIN_COMMANDS,
    UNKNOWN_COMMAND_NAME,
    COMMANDER_ERROR_PREFIX,
} from '#cli/config/main.ts';

function formatArgumentError(error: CommanderError, programHelp: string): string {
    const { message } = error;
    if (error.code === HELP_ERROR_CODE) return programHelp;
    if (error.code === 'commander.unknownCommand') {
        const [, name] = UNKNOWN_COMMAND_NAME.exec(message) as RegExpExecArray & { 1: string };
        const suggestion = COMMAND_SUGGESTION.exec(message)?.[1];
        const correction = suggestion === undefined ? '' : ` Did you mean ${suggestion}?`;
        return `Unknown command ${name}.${correction} Run gspot --help to see the commands.`;
    }
    const text = message.slice(COMMANDER_ERROR_PREFIX.length);
    return `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
}

function printFailure(error: unknown, programHelp: string): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        printError({ error: 'arguments', message: formatArgumentError(error, programHelp) });
        return EXIT_ERROR;
    }
    if (error instanceof GspotError) {
        printError({ error: error.code, message: error.message });
        return EXIT_ERROR;
    }
    const detail = (error instanceof Error ? error.message : String(error))
        .replaceAll(WHITESPACE_RUN, ' ')
        .trim()
        .replace(TRAILING_PERIOD, '');
    const message = `gspot stopped because of an internal error: ${detail}. Report it at https://github.com/stefanionescu/gspot/issues with the command you ran.`;
    printError({ error: 'unexpected', message });
    return EXIT_ERROR;
}

function formatArgumentTerm(argument: Argument): string {
    const name = argument.argChoices?.join('|') ?? argument.name();
    const shown = argument.variadic ? `${name}...` : name;
    return argument.required ? `<${shown}>` : `[${shown}]`;
}

function formatExitCodes(rows: readonly (readonly [codes: string, meaning: string])[]): string {
    const width = Math.max(...rows.map(([codes]) => codes.length)) + EXIT_CODE_SPACING;
    return rows.map(([codes, meaning]) => `  ${codes.padEnd(width)}${meaning}`).join('\n');
}

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
    const options = Object.entries(GLOBAL_OPTIONS).map(
        ([flags, description]) => `  ${flags.padEnd(HELP_TERM_WIDTH)}${description}`,
    );
    return [
        USAGE_LINE,
        program.description(),
        sections.join('\n\n'),
        `Options:\n${options.join('\n')}`,
        `Exit codes:\n${formatExitCodes(PROGRAM_EXIT_CODES)}`,
        PROGRAM_HELP_FOOTER,
    ].join('\n\n');
}

/**
Build the CLI with every command.

@param onResult receives the result of the command that ran.
*/
export function buildProgram(onResult: CommandCompletion): Command {
    const program: Command = new Command('gspot')
        .description(cliPackage.description)
        .enablePositionalOptions()
        .version(cliPackage.version, '--version', GLOBAL_OPTIONS['--version'])
        .helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG])
        .helpCommand(false)
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
        command.helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG]);
        command.option('--json', help.options['--json']);
        command.addHelpText(
            'after',
            `\nExit codes:\n${formatExitCodes(help.exitCodes)}\n\nExample:\n  ${help.example}\n`,
        );
        command.configureHelp({ styleDescriptionText: (text) => text.replaceAll(CODE_MARK, '') });
    }
    program.configureHelp({ formatHelp: () => formatProgramHelp(program) });
    return program;
}

/**
Run one gspot command, and print its result or its error.

@param commandArguments the arguments after the program name.
@returns the exit code.
*/
export async function runProgram(commandArguments: string[]): Promise<number> {
    let result!: CommandResult;
    const program = buildProgram((value) => {
        result = value;
    });
    const separator = commandArguments.indexOf('--');
    const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
    setOutputOptions({
        isJson: options.includes('--json'),
        colored:
            [undefined, ''].includes(readEnvironmentVariable('NO_COLOR')) &&
            [process.stderr.isTTY, process.stdout.isTTY].every((tty: unknown) => tty === true),
    });
    if (options.includes('--version')) {
        printResult({ text: cliPackage.version, json: { version: cliPackage.version }, exitCode: 0 });
        return 0;
    }
    program.hook('preAction', (_program, command) => {
        if (GIT_COMMANDS.has(command.name()) && !isGitRepository(process.cwd()))
            throw new GspotError('git', NEEDS_GIT_MESSAGE);
        if (VERSION_PIN_COMMANDS.has(command.name())) assertVersionPin(readRepositoryRoot(process.cwd()));
    });
    try {
        await program.parseAsync(commandArguments, { from: 'user' });
        printResult(result);
        return result.exitCode;
    } catch (error) {
        return printFailure(error, formatProgramHelp(program));
    }
}
