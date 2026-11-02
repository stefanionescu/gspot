import { addCommand } from '#cli/commands/add.ts';
import { setCommand } from '#cli/commands/set.ts';
import { EXIT_ERROR } from '#cli/config/system.ts';
import { GspotError } from '#cli/system/errors.ts';
import { listCommand } from '#cli/commands/list.ts';
import { formatNameList } from '#cli/system/text.ts';
import { applyCommand } from '#cli/commands/apply.ts';
import { unsetCommand } from '#cli/commands/unset.ts';
import type { InvalidValue } from '#cli/types/main.ts';
import { ignoreCommand } from '#cli/commands/ignore.ts';
import { removeCommand } from '#cli/commands/remove.ts';
import { initCommand } from '#cli/commands/init/init.ts';
import { scanCommand } from '#cli/commands/scan/scan.ts';
import { installCommand } from '#cli/commands/install.ts';
import cliPackage from '#cli-package' with { type: 'json' };
import { baselineCommand } from '#cli/commands/baseline.ts';
import { checkCommand } from '#cli/commands/check/check.ts';
import { unignoreCommand } from '#cli/commands/unignore.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { doctorCommand } from '#cli/commands/doctor/doctor.ts';
import { beginCheckReport } from '#cli/commands/check/report.ts';
import { explainCommand } from '#cli/commands/explain/explain.ts';
import { runGit, buildGitError } from '#cli/repository/git/run.ts';
import { CODE_MARK, COMMAND_HELP } from '#cli/config/commands/help.ts';
import { assertGspotPin } from '#cli/repository/javascript/gspot-pin.ts';
import { DASH_VALUE_HELP, COMMAND_SUGGESTION } from '#cli/config/commands/edits.ts';
import { Option, Command, Argument, type Help, CommanderError } from '@commander-js/extra-typings';
import { printError, printResult, setOutputOptions, printUnexpectedError } from '#cli/system/terminal.ts';

import type {
    CommandHelp,
    CommandOption,
    CommandArgument,
    CommandDefinition,
    CommandCompletion,
} from '#cli/types/commands/edits.ts';
import {
    HELP_FLAG,
    JSON_FLAG,
    USAGE_LINE,
    HELP_WIDTH,
    VERSION_FLAG,
    PIN_COMMANDS,
    INVALID_VALUE,
    GLOBAL_OPTIONS,
    HELP_ERROR_CODE,
    ALLOWED_CHOICES,
    PROGRAM_EXIT_CODES,
    PROGRAM_HELP_FOOTER,
    UNKNOWN_COMMAND_NAME,
    COMMANDS_HELP_MESSAGE,
    COMMANDER_ERROR_PREFIX,
    UNKNOWN_OPTION_ERROR_CODE,
    UNKNOWN_COMMAND_ERROR_CODE,
} from '#cli/config/main.ts';

function formatInvalidValue(message: string, command: string | undefined): string | undefined {
    const groups = INVALID_VALUE.exec(message)?.groups as InvalidValue | undefined;
    if (groups === undefined) return undefined;
    const { option, value, detail } = groups;
    const choices = ALLOWED_CHOICES.exec(detail)?.[1]?.split(', ');
    const fix = choices === undefined ? detail : `Use ${formatNameList(choices, 'disjunction')}.`;
    const subject = option ?? `gspot ${String(command)}`;
    return `The value ${value} is not valid for ${subject}. ${fix}`;
}

function formatCommanderSentence(error: CommanderError, command: string | undefined): string {
    const invalid = formatInvalidValue(error.message, command);
    if (invalid !== undefined) return invalid;
    const text = error.message.slice(COMMANDER_ERROR_PREFIX.length).replace(COMMAND_SUGGESTION, '').trim();
    const sentence = `${text.charAt(0).toUpperCase()}${text.slice(1)}${text.endsWith('.') ? '' : '.'}`;
    return command === 'set' && error.code === UNKNOWN_OPTION_ERROR_CODE ? `${sentence} ${DASH_VALUE_HELP}` : sentence;
}

function formatArgumentError(error: CommanderError, program: Command, command: string | undefined): string {
    const { message } = error;
    if (error.code === HELP_ERROR_CODE) return formatProgramHelp(program);
    const suggestion = COMMAND_SUGGESTION.exec(message)?.[1];
    const correction = suggestion === undefined ? '' : ` Did you mean ${suggestion}?`;
    if (error.code === UNKNOWN_COMMAND_ERROR_CODE) {
        const [, name] = UNKNOWN_COMMAND_NAME.exec(message) as RegExpExecArray & { 1: string };
        return `There is no command called ${name}.${correction} ${COMMANDS_HELP_MESSAGE}`;
    }
    const helpLine =
        command === undefined ? COMMANDS_HELP_MESSAGE : `Run gspot ${command} --help to see its arguments and options.`;
    return `${formatCommanderSentence(error, command)}${correction} ${helpLine}`;
}

function printFailure(error: unknown, program: Command, commandArguments: string[]): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        if (error.code === HELP_ERROR_CODE && program.getOptionValue('version') === true) {
            printResult({ text: cliPackage.version, json: {}, exitCode: 0 });
            return 0;
        }
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

function formatExitCodes(rows: CommandHelp['exitCodes'], layout: Help): string {
    const width = Math.max(...rows.map(([codes]) => codes.length));
    return rows.map(([codes, meaning]) => layout.formatItem(codes, width, meaning, layout)).join('\n');
}

function formatProgramHelp(program: Command): string {
    const layout = program.createHelp();
    const rows = program.commands.map((command) => ({
        help: COMMAND_HELP[command.name() as keyof typeof COMMAND_HELP],
        term: [command.name(), ...command.registeredArguments.map((argument) => formatArgumentTerm(argument))].join(
            ' ',
        ),
    }));
    const width = Math.max(...rows.map(({ term }) => term.length));
    const groups = Map.groupBy(rows, ({ help }) => help.group);
    const sections = [...groups].map(([group, commands]) => {
        const lines = commands.map(({ term, help }) => layout.formatItem(term, width, help.summary, layout));
        return `${group}\n${lines.join('\n')}`;
    });
    const options = Object.entries(GLOBAL_OPTIONS).map(([flags, description]) =>
        layout.formatItem(flags, width, description, layout),
    );
    return [
        USAGE_LINE,
        program.description(),
        sections.join('\n\n'),
        `Options:\n${options.join('\n')}`,
        `Exit codes:\n${formatExitCodes(PROGRAM_EXIT_CODES, layout)}`,
        PROGRAM_HELP_FOOTER,
    ].join('\n\n');
}

function buildArgument({ term, choices, defaultValue }: CommandArgument, description: string | undefined): Argument {
    const argument = new Argument(term, description);
    if (choices !== undefined) argument.choices(choices);
    if (defaultValue !== undefined) argument.default(defaultValue);
    return argument;
}

function buildOption({ flags, choices, required, parse }: CommandOption, description: string | undefined): Option {
    const option = new Option(flags, description);
    if (choices !== undefined) option.choices(choices);
    if (required === true) option.makeOptionMandatory();
    if (parse !== undefined) option.argParser(parse as (value: string, previous: unknown) => unknown);
    return option;
}

function addCommandDefinition(program: Command, definition: CommandDefinition): Command {
    const help: CommandHelp = COMMAND_HELP[definition.name];
    const command = program
        .command(definition.name)
        .summary(help.summary)
        .description(help.description)
        .helpGroup(help.group);
    const { arguments: definedArguments = [], options = [] } = definition;
    for (const argument of definedArguments)
        command.addArgument(buildArgument(argument, help.arguments[argument.term]));
    for (const option of options) command.addOption(buildOption(option, help.options[option.flags]));
    command.helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG]);
    command.option(JSON_FLAG, help.options[JSON_FLAG]);
    command.configureHelp({ helpWidth: HELP_WIDTH, styleDescriptionText: (text) => text.replaceAll(CODE_MARK, '') });
    const exitCodes = formatExitCodes(help.exitCodes, command.createHelp());
    command.addHelpText('after', `\nExit codes:\n${exitCodes}\n\nExample:\n  ${help.example}\n`);
    return command;
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
        .option(VERSION_FLAG, GLOBAL_OPTIONS[VERSION_FLAG])
        .option(JSON_FLAG)
        .helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG])
        .helpCommand(false)
        .exitOverride();
    program.configureOutput({ writeErr: () => {} });
    program.hook('preAction', async (_program, action) => {
        location.root = await readRepositoryRoot(location.cwd);
        const command = ['config', '--bool', '--get', 'core.sparseCheckout'];
        const sparse = await runGit(location.root, command, {});
        if (sparse.code === 0 && sparse.stdout.trim() === 'true')
            throw new GspotError('git', 'gspot does not support sparse checkouts. Run git sparse-checkout disable.');
        if (sparse.code !== 0 && sparse.code !== 1) throw buildGitError(location.root, command, sparse);
        if (PIN_COMMANDS.has(action.name())) assertGspotPin(location.root);
    });
    const definitions: readonly CommandDefinition[] = [
        scanCommand,
        initCommand,
        installCommand,
        applyCommand,
        checkCommand,
        baselineCommand,
        addCommand,
        removeCommand,
        setCommand,
        unsetCommand,
        ignoreCommand,
        unignoreCommand,
        listCommand,
        explainCommand,
        doctorCommand,
    ];
    for (const definition of definitions) {
        const command = addCommandDefinition(program, definition);
        command.action(async () => {
            onResult(await definition.run(command.processedArgs, command.opts(), location));
        });
    }
    program.configureHelp({ helpWidth: HELP_WIDTH, formatHelp: () => formatProgramHelp(program) });
    return program;
}

/**
Run one gspot command, and print its result or its error.

@param commandArguments the arguments after the program name.
@returns the exit code.
*/
export async function runProgram(commandArguments: string[]): Promise<number> {
    const separator = commandArguments.indexOf('--');
    const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
    setOutputOptions({ isJson: options.includes(JSON_FLAG) });
    let exitCode = 0;
    const program = buildProgram((result) => {
        printResult(result);
        ({ exitCode } = result);
    });
    let endReport: (() => void) | undefined;
    program.hook('preAction', (_program, command) => {
        if (command.name() === 'check') endReport = beginCheckReport();
    });
    try {
        await program.parseAsync(commandArguments, { from: 'user' });
        return exitCode;
    } catch (error) {
        return printFailure(error, program, commandArguments);
    } finally {
        endReport?.();
    }
}
