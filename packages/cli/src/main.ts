import { registerAdd } from '#cli/commands/add.ts';
import { registerSet } from '#cli/commands/set.ts';
import { GspotError } from '#cli/system/errors.ts';
import { registerList } from '#cli/commands/list.ts';
import { EXIT_ERROR } from '#cli/config/terminal.ts';
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
import { beginCheckReport } from '#cli/commands/check/report.ts';
import { registerExplain } from '#cli/commands/explain/explain.ts';
import { runGit, buildGitError } from '#cli/repository/git/run.ts';
import type { CommandResult, CommandCompletion } from '#cli/types/terminal.ts';
import { Command, type Argument, CommanderError } from '@commander-js/extra-typings';
import { printError, printResult, setOutputOptions, printUnexpectedError } from '#cli/system/terminal.ts';

import {
    HELP_FLAG,
    JSON_FLAG,
    CODE_MARK,
    USAGE_LINE,
    GLOBAL_OPTIONS,
    HELP_ERROR_CODE,
    HELP_TERM_WIDTH,
    EXIT_CODE_SPACING,
    COMMAND_SUGGESTION,
    PROGRAM_EXIT_CODES,
    PROGRAM_HELP_FOOTER,
    UNKNOWN_COMMAND_NAME,
    COMMANDS_HELP_MESSAGE,
    COMMANDER_ERROR_PREFIX,
} from '#cli/config/main.ts';

function formatArgumentError(error: CommanderError, program: Command, command: string | undefined): string {
    const { message } = error;
    if (error.code === HELP_ERROR_CODE) return formatProgramHelp(program);
    const suggestion = COMMAND_SUGGESTION.exec(message)?.[1];
    const correction = suggestion === undefined ? '' : ` Did you mean ${suggestion}?`;
    if (error.code === 'commander.unknownCommand') {
        const [, name] = UNKNOWN_COMMAND_NAME.exec(message) as RegExpExecArray & { 1: string };
        return `There is no command called ${name}.${correction} ${COMMANDS_HELP_MESSAGE}`;
    }
    const text = message.slice(COMMANDER_ERROR_PREFIX.length).replace(COMMAND_SUGGESTION, '').trim();
    const sentence = `${text.charAt(0).toUpperCase()}${text.slice(1)}${text.endsWith('.') ? '' : '.'}`;
    const helpLine =
        command === undefined ? COMMANDS_HELP_MESSAGE : `Run gspot ${command} --help to see its arguments and options.`;
    return `${sentence}${correction} ${helpLine}`;
}

function printFailure(error: unknown, program: Command, commandArguments: string[]): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        const command = program.commands.find((each) => each.name() === commandArguments[0])?.name();
        printError({ error: 'arguments', message: formatArgumentError(error, program, command) });
        return EXIT_ERROR;
    }
    if (error instanceof GspotError) {
        printError({ error: error.code, message: error.message });
        return EXIT_ERROR;
    }
    const separator = commandArguments.indexOf('--');
    const flags = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
    printUnexpectedError(error, flags.includes('--verbose'));
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
    const cwd = process.cwd();
    const location = { cwd, root: cwd };
    const program: Command = new Command('gspot')
        .description(cliPackage.description)
        .enablePositionalOptions()
        .version(cliPackage.version, '--version', GLOBAL_OPTIONS['--version'])
        .helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG])
        .helpCommand(false)
        .exitOverride();
    program.configureOutput({ writeErr: () => {} });
    program.hook('preAction', async () => {
        location.root = await readRepositoryRoot(location.cwd);
        const command = ['config', '--bool', '--get', 'core.sparseCheckout'];
        const sparse = await runGit(location.root, command, {});
        if (sparse.code === 0 && sparse.stdout.trim() === 'true')
            throw new GspotError('git', 'gspot does not support sparse checkouts. Run git sparse-checkout disable.');
        if (sparse.code !== 0 && sparse.code !== 1) throw buildGitError(location.root, command, sparse);
    });
    registerInit(program, onResult, location);
    registerInstall(program, onResult, location);
    registerApply(program, onResult, location);
    registerCheck(program, onResult, location);
    registerAdd(program, onResult, location);
    registerRemove(program, onResult, location);
    registerSet(program, onResult, location);
    registerUnset(program, onResult, location);
    registerIgnore(program, onResult, location);
    registerUnignore(program, onResult, location);
    registerList(program, onResult, location);
    registerExplain(program, onResult, location);
    registerDoctor(program, onResult, location);
    for (const command of program.commands) {
        const help = COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP];
        command.helpGroup(help.group);
        command.helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG]);
        command.option(JSON_FLAG, help.options[JSON_FLAG]);
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
    setOutputOptions({ isJson: options.includes(JSON_FLAG) });
    if (options.includes('--version')) {
        printResult({ text: cliPackage.version, json: { version: cliPackage.version }, exitCode: 0 });
        return 0;
    }
    let endReport: (() => void) | undefined;
    program.hook('preAction', (_program, command) => {
        if (command.name() === 'check' && !options.includes(JSON_FLAG)) endReport = beginCheckReport();
    });
    try {
        await program.parseAsync(commandArguments, { from: 'user' });
        printResult(result);
        return result.exitCode;
    } catch (error) {
        return printFailure(error, program, commandArguments);
    } finally {
        endReport?.();
    }
}
