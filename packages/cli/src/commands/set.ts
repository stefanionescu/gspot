// Preview or publish setting changes with the same validation and mutation.
import { readPolicy } from '#cli/policy/public.ts';
import { GspotError } from '#cli/platform/public.ts';
import { Option } from '@commander-js/extra-typings';
import { printResult } from '#cli/terminal/public.ts';
import { savePolicy } from '#cli/commands/contracts.ts';
import type { CommandResult } from '#cli/types/terminal.ts';
import { assertVersionPin } from '#cli/lifecycle/public.ts';
import { EXIT_ERROR } from '#cli/config/platform/runtime.ts';
import type { Program } from '#cli/types/commands/program.ts';
import { knownSettings } from '#cli/policy/settings/public.ts';
import { parseTomlText } from '#cli/policy/document/public.ts';
import { findRoot } from '#cli/repository/discovery/contracts.ts';
import { commandHelp, commandRoot } from '#cli/commands/public.ts';
import { selectForScope } from '#cli/repository/selection/public.ts';
import type { SettingDeclaration } from '#cli/types/configurations.ts';
import { configurationManifests } from '#cli/configurations/public.ts';
import { unknownSettingDiagnostic } from '#cli/policy/errors/public.ts';
import { DECIMAL, INTEGER, STRUCTURED } from '#cli/config/commands/set.ts';
import { compact, isRecord, quoteArgument } from '#cli/platform/contracts.ts';
import type { SetOptions, ParsedSettingValue } from '#cli/types/commands/set.ts';
import { settingValue, declarationFor } from '#cli/policy/settings/contracts.ts';
import type { Policy, Mutation, KnownSettings } from '#cli/types/policy/settings.ts';
import { setKey, addToList, deleteKey, getScopeTable, removeFromList } from '#cli/policy/document/contracts.ts';

// Text that reads as neither is refused: kept as a string, it lands in the policy as a quoted table nothing reads.
function parseStructured(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        // The TOML form is tried next.
    }
    try {
        return parseTomlText(`value = ${text}`, 'value', 'policy')['value'];
    } catch {
        throw new GspotError('policy', [
            `The value ${text} reads as neither JSON nor TOML. Write a list as ["a", "b"] and a table as {key = "value"}, inside single quotes for the shell.`,
        ]);
    }
}

function parseItem(text: string): unknown {
    if (text === 'true') return true;
    if (text === 'false') return false;
    if (INTEGER.test(text) || DECIMAL.test(text)) return Number(text);
    const isStructured = STRUCTURED.test(text);
    return isStructured ? parseStructured(text) : text;
}

function buildSettingError(policy: Policy, surface: KnownSettings, key: string): GspotError {
    const manifests = configurationManifests();
    const holder = Object.keys(policy.scope).find(
        (scope) =>
            declarationFor(knownSettings(selectForScope(policy, scope, manifests), policy.level), key) !== undefined,
    );
    if (holder !== undefined)
        return new GspotError('policy', [
            `A configuration has the setting \`${key}\` in the scope \`${holder}\`; add --scope ${quoteArgument(holder)}.`,
        ]);
    return new GspotError('policy', [unknownSettingDiagnostic(surface, key)]);
}

function parseSettingValue(
    items: string[],
    declaration: SettingDeclaration,
    reason: string | undefined,
): ParsedSettingValue {
    const parsed = items.map((item) => parseItem(item));
    const [only] = parsed;
    const itemReasons = isRecord(declaration.items) && Object.hasOwn(declaration.items, 'reason');
    if (declaration.type === 'list') {
        const value: unknown[] = parsed.length === 1 && Array.isArray(only) ? only : parsed;
        return {
            type: 'list',
            value: value.map((item) =>
                reason === undefined || !itemReasons || !isRecord(item)
                    ? item
                    : { ...item, reason: item['reason'] ?? reason },
            ),
        };
    }
    return { type: 'scalar', value: parsed.length === 1 ? only : parsed };
}

// What set did: the new value, or the items it added to or removed from a list.
function changeText(options: SetOptions, isList: boolean, label: string, value: unknown): string {
    const items = JSON.stringify(value);
    if (!isList || options.replace) return `${label} = ${items}`;
    return `${options.remove ? 'removed from' : 'added to'} ${label}: ${items}`;
}

function describeSet(
    policy: Policy,
    surface: KnownSettings,
    options: SetOptions,
    label: string,
    value: unknown,
    isList: boolean,
): string {
    const previous = settingValue(surface, policy, options.key, options.scope);
    const reason = options.reason === undefined ? '' : `  # ${options.reason}`;
    const was = previous === undefined ? '' : `  (was ${JSON.stringify(previous.value)} from ${previous.source})`;
    return `${changeText(options, isList, label, value)}${reason}${was}`;
}

async function changeSetting(
    root: string,
    policy: Policy,
    surface: KnownSettings,
    options: SetOptions,
    declaration: SettingDeclaration,
    shown: string,
): Promise<CommandResult> {
    if (options.items.length === 0)
        throw new GspotError('policy', [
            `The setting ${options.key} needs a value; pass one, or --default to remove yours.`,
        ]);
    const change = parseSettingValue(options.items, declaration, options.reason);
    const isList = change.type === 'list';
    const value = change.value;
    const reason =
        change.type === 'list' && isRecord(declaration.items) && Object.hasOwn(declaration.items, 'reason')
            ? undefined
            : options.reason;
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        if (change.type === 'list' && options.remove) removeFromList(holder, options.key, change.value);
        else if (change.type === 'list' && !options.replace) addToList(holder, options.key, change.value);
        else setKey(holder, options.key, change.value);
        if (reason !== undefined) {
            const reasons = isRecord(holder['reasons']) ? holder['reasons'] : {};
            reasons[options.key] = reason;
            holder['reasons'] = reasons;
        }
    };
    const summary = describeSet(policy, surface, options, shown, value, isList);
    const result = await savePolicy(root, { change: mutation, summary, isDryRun: options.isDryRun });
    return options.remove && result.exitCode === 0 && !result.json.changed
        ? { ...result, text: 'nothing to remove\n' }
        : result;
}

/**
 * Previews or writes a setting, edits a list, or returns a key to its default.
 * @param options the parsed flags
 * @returns the command result
 */
async function setCommand(options: SetOptions): Promise<CommandResult> {
    const root = findRoot(options.cwd);
    assertVersionPin(root);
    const { policy } = readPolicy(root);
    if (options.scope !== undefined && !Object.hasOwn(policy.scope, options.scope))
        throw new GspotError('policy', [
            `No policy scope matches ${options.scope}. Available scopes: ${['root', ...Object.keys(policy.scope)].join(', ')}.`,
        ]);
    const surface = knownSettings(selectForScope(policy, options.scope ?? '', configurationManifests()), policy.level);
    const match = declarationFor(surface, options.key);
    if (!match) throw buildSettingError(policy, surface, options.key);
    const shown = options.scope === undefined ? options.key : `scope.${options.scope}.${options.key}`;
    if (!options.toDefault) return await changeSetting(root, policy, surface, options, match.declaration, shown);
    const mutation: Mutation = (raw) => {
        const holder = getScopeTable(raw, options.scope);
        deleteKey(holder, options.key);
        const reasons = holder['reasons'];
        if (isRecord(reasons)) {
            Reflect.deleteProperty(reasons, options.key);
            if (Object.keys(reasons).length === 0) Reflect.deleteProperty(holder, 'reasons');
        }
    };
    const summary = `${shown} back to the shipped default`;
    return await savePolicy(root, { change: mutation, summary, isDryRun: options.isDryRun });
}

/**
 * Registers set.
 * @param program the commander program
 */
export function registerSet(program: Program): void {
    program
        .command('set')
        .argument('<setting>', 'Dotted setting name from gspot list settings')
        .argument('[value...]', 'Setting value or list items; omit with --default')
        .summary('Change a setting')
        .description(
            'Write one setting to gspot.toml and apply it. gspot checks the value first. The setting is the dotted name that gspot list settings prints. A list value adds to the list unless you pass --replace or --remove. Use only one of --replace, --remove, and --default. --default takes no value. set installs no tools: run gspot install for that. --dry-run prints the change and writes nothing.',
        )
        .addHelpText('after', commandHelp('set'))
        .option('--reason <text>', 'Say why; required to loosen a setting')
        .option('--scope <path>', 'Write the setting in this scope instead of the root')
        .addOption(new Option('--replace', 'Replace the whole list; use --replace or --remove').conflicts('remove'))
        .option('--remove', 'Remove these items from the list')
        .addOption(
            new Option(
                '--default',
                'Restore the inherited or default value. Omit values, --replace, and --remove.',
            ).conflicts(['replace', 'remove']),
        )
        .option('--dry-run', 'Print the change and write nothing')
        .action(async (setting, items, flags, command) => {
            if (flags.default === true && items.length > 0)
                command.error('--default cannot be used with setting values.', { exitCode: EXIT_ERROR });
            printResult(
                await setCommand({
                    cwd: commandRoot(command),
                    key: setting,
                    items,
                    replace: flags.replace === true,
                    remove: flags.remove === true,
                    toDefault: flags.default === true,
                    isDryRun: flags.dryRun === true,
                    ...compact({ reason: flags.reason, scope: flags.scope }),
                }),
            );
        });
}
