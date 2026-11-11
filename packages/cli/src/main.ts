import { Argument, Command, CommanderError, type Help, Option } from '@commander-js/extra-typings';

import cliPackage from '#cli-package' with { type: 'json' };
import { ADD_COMMAND } from '#cli/commands/add.ts';
import { CHECK_COMMAND } from '#cli/commands/check/check.ts';
import { beginCheckReport } from '#cli/commands/check/report.ts';
import { DOCTOR_COMMAND } from '#cli/commands/doctor.ts';
import { EXPLAIN_COMMAND } from '#cli/commands/explain/explain.ts';
import { IGNORE_COMMAND } from '#cli/commands/ignore.ts';
import { INIT_COMMAND } from '#cli/commands/init/init.ts';
import { INSTALL_COMMAND } from '#cli/commands/install.ts';
import { LIST_COMMAND } from '#cli/commands/list.ts';
import { REMOVE_COMMAND } from '#cli/commands/remove.ts';
import { SCAN_COMMAND } from '#cli/commands/scan/scan.ts';
import { SET_COMMAND } from '#cli/commands/set.ts';
import { UNIGNORE_COMMAND } from '#cli/commands/unignore.ts';
import { UNSET_COMMAND } from '#cli/commands/unset.ts';
import { COMMAND_SUGGESTION, DASH_VALUE_HELP } from '#cli/config/commands/edits.ts';
import { CODE_MARK, COMMAND_HELP } from '#cli/config/commands/help.ts';
import {
    ALLOWED_CHOICES,
    COMMANDER_ERROR_PREFIX,
    COMMANDS_HELP_MESSAGE,
    GLOBAL_OPTIONS,
    HELP_ERROR_CODE,
    HELP_FLAG,
    HELP_MIN_WRAP_WIDTH,
    HELP_WIDTH,
    INVALID_VALUE,
    JSON_FLAG,
    PIN_COMMANDS,
    PROGRAM_EXIT_CODES,
    PROGRAM_HELP_FOOTER,
    UNKNOWN_COMMAND_ERROR_CODE,
    UNKNOWN_COMMAND_NAME,
    UNKNOWN_OPTION_ERROR_CODE,
    USAGE_LINE,
    VERBOSE_FLAG,
    VERSION_FLAG,
} from '#cli/config/main.ts';
import { EXIT_ERROR } from '#cli/config/system.ts';
import { buildGitError, runGit } from '#cli/repository/git/run.ts';
import { readRepositoryRoot } from '#cli/repository/read.ts';
import { assertGspotPin } from '#cli/repository/version-pin.ts';
import { GspotError } from '#cli/system/errors.ts';
import { print, printError, printResult, printUnexpectedError, setOutputOptions } from '#cli/system/terminal.ts';
import { formatNameList } from '#cli/system/text.ts';
import type {
    CommandArgument,
    CommandCompletion,
    CommandDefinition,
    CommandHelp,
    CommandOption,
} from '#cli/types/commands/edits.ts';
import type { InvalidValue } from '#cli/types/main.ts';

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

function readCorrection(message: string): string {
    const suggestion = COMMAND_SUGGESTION.exec(message)?.[1];
    return suggestion === undefined ? '' : ` Did you mean ${suggestion}?`;
}

function formatArgumentError(error: CommanderError, program: Command, command: string | undefined): string {
    const { message } = error;
    if (error.code === HELP_ERROR_CODE) return formatProgramHelp(program);
    if (error.code === UNKNOWN_COMMAND_ERROR_CODE) {
        const [, name] = UNKNOWN_COMMAND_NAME.exec(message) as RegExpExecArray & { 1: string };
        return `There is no command called ${name}.${readCorrection(message)} ${COMMANDS_HELP_MESSAGE}`;
    }
    const helpLine =
        command === undefined ? COMMANDS_HELP_MESSAGE : `Run gspot ${command} --help to see its arguments and options.`;
    return `${formatCommanderSentence(error, command)}${readCorrection(message)} ${helpLine}`;
}

function printFailure(error: unknown, program: Command, options: string[]): number {
    if (error instanceof CommanderError) {
        if (error.exitCode === 0) return 0;
        const first = options.find((option) => !option.startsWith('-'));
        const command = program.commands.find((each) => each.name() === first)?.name();
        printError({ error: 'arguments', message: formatArgumentError(error, program, command) });
        return EXIT_ERROR;
    }
    if (error instanceof GspotError) {
        printError({ error: error.code, message: error.message });
        return EXIT_ERROR;
    }
    printUnexpectedError(error, options.includes(VERBOSE_FLAG));
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

function buildOption(
    { flags, choices, required, hidden, parse }: CommandOption,
    description: string | undefined,
): Option {
    const option = new Option(flags, description);
    if (choices !== undefined) option.choices(choices);
    if (required === true) option.makeOptionMandatory();
    if (hidden === true) option.hideHelp();
    if (parse !== undefined) option.argParser(parse as (value: string, previous: unknown) => unknown);
    return option;
}

function addCommandDefinition(program: Command, definition: CommandDefinition, helpWidth: number): Command {
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
    command.option(VERBOSE_FLAG, help.options[VERBOSE_FLAG] ?? GLOBAL_OPTIONS[VERBOSE_FLAG]);
    command.option(JSON_FLAG, help.options[JSON_FLAG] ?? GLOBAL_OPTIONS[JSON_FLAG]);
    command.helpOption(HELP_FLAG, GLOBAL_OPTIONS[HELP_FLAG]);
    command.configureHelp({
        helpWidth,
        minWidthToWrap: HELP_MIN_WRAP_WIDTH,
        styleDescriptionText: (text) => text.replaceAll(CODE_MARK, ''),
    });
    const exitCodes = formatExitCodes(help.exitCodes, command.createHelp());
    command.addHelpText('after', `\nExit codes:\n${exitCodes}\n\nExample:\n  ${help.example}\n`);
    return command;
}

function isVersionRun(program: Command, name: string): boolean {
    if (program.getOptionValue('version') !== true) return false;
    return name === '' || program.commands.some((command) => command.name() === name);
}

export function buildProgram(onResult: CommandCompletion, cwd: string): Command {
    const location = { cwd, root: cwd };
    const program: Command = new Command('gspot')
        .description(cliPackage.description)
        .enablePositionalOptions()
        .option(VERSION_FLAG, GLOBAL_OPTIONS[VERSION_FLAG])
        .option(JSON_FLAG, GLOBAL_OPTIONS[JSON_FLAG])
        .option(VERBOSE_FLAG, GLOBAL_OPTIONS[VERBOSE_FLAG])
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
        if (sparse.code !== 0 && sparse.code !== 1) throw buildGitError(command, sparse);
        if (PIN_COMMANDS.has(action.name())) assertGspotPin(location.root);
    });
    const definitions: readonly CommandDefinition[] = [
        SCAN_COMMAND,
        INIT_COMMAND,
        INSTALL_COMMAND,
        CHECK_COMMAND,
        ADD_COMMAND,
        REMOVE_COMMAND,
        SET_COMMAND,
        UNSET_COMMAND,
        IGNORE_COMMAND,
        UNIGNORE_COMMAND,
        LIST_COMMAND,
        EXPLAIN_COMMAND,
        DOCTOR_COMMAND,
    ];
    const { columns } = process.stdout;
    const helpWidth = columns > 0 ? Math.min(HELP_WIDTH, columns) : HELP_WIDTH;
    for (const definition of definitions) {
        const command = addCommandDefinition(program, definition, helpWidth);
        command.action(async () => {
            onResult(
                await definition.run({
                    arguments: command.processedArgs,
                    flags: command.optsWithGlobals(),
                    ...location,
                }),
            );
        });
    }
    program.configureHelp({
        helpWidth,
        minWidthToWrap: HELP_MIN_WRAP_WIDTH,
        formatHelp: () => formatProgramHelp(program),
    });
    return program;
}

export async function runProgram(commandArguments: string[], cwd: string): Promise<number> {
    const separator = commandArguments.indexOf('--');
    const options = separator === -1 ? commandArguments : commandArguments.slice(0, separator);
    setOutputOptions({ isJson: options.includes(JSON_FLAG) });
    let exitCode = 0;
    let annotations: readonly string[] = [];
    const program = buildProgram((result) => {
        printResult(result);
        ({ exitCode, annotations = [] } = result);
    }, cwd);
    let endReport: (() => void) | undefined;
    program.hook('preAction', (_program, command) => {
        if (command.name() === 'check') endReport = beginCheckReport();
    });
    try {
        const [name = ''] = program.parseOptions(commandArguments).operands;
        if (isVersionRun(program, name)) {
            printResult({ text: cliPackage.version, json: {}, exitCode: 0 });
            return 0;
        }
        await program.parseAsync(commandArguments, { from: 'user' });
        return exitCode;
    } catch (error) {
        return printFailure(error, program, options);
    } finally {
        endReport?.();
        for (const annotation of annotations) print(annotation);
    }
}
