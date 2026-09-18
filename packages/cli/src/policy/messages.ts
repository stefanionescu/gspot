// Every load and write message, in plain English. One function per message.

const LIST_LIMIT = 8;

function list(items: string[], limit = LIST_LIMIT): string {
    const shown = items.slice(0, limit);
    const rest = items.length - shown.length;
    const more = rest > 0 ? ` and ${String(rest)} more` : '';
    return shown.map((item) => `\`${item}\``).join(', ') + more;
}

/**
 * The policy file is not there.
 * @param path the path that was looked for
 * @returns the message
 */
export function fileMissing(path: string): string {
    return `There is no ${path} here. Run \`gspot init\` to create one.`;
}

/**
 * The file did not parse as TOML.
 * @param path the file
 * @param detail what the parser said
 * @returns the message
 */
export function tomlSyntax(path: string, detail: string): string {
    return `${path} is not valid TOML: ${detail}`;
}

/**
 * A key under a table that the schema does not know.
 * @param where the table, empty for the top level
 * @param key the unknown key
 * @param known the keys the table does accept
 * @returns the message
 */
export function unknownKey(where: string, key: string, known: string[]): string {
    const table = where === '' ? 'the top level' : `[${where}]`;
    return `\`${key}\` is not a setting gspot knows under ${table}. The keys that exist there are ${list(known)}.`;
}

/**
 * A reason that is empty or a placeholder.
 * @param where the command or key the reason belongs to
 * @param reason the reason as written
 * @returns the message
 */
export function refusedReason(where: string, reason: string): string {
    const shown = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${shown} is refused. Write one sentence saying why.`;
}

/**
 * A loosening without a reason.
 * @param where the command or key that needs one
 * @param command the command line that carries the reason
 * @returns the message
 */
export function missingReason(where: string, command: string): string {
    return `${where} needs a reason. Add \`reason = "..."\` or run: ${command}`;
}

/**
 * A preset id nothing ships.
 * @param name the id as written
 * @param near the closest ids that exist
 * @returns the message
 */
export function unknownPreset(name: string, near: string[]): string {
    const hint = near.length > 0 ? ` Did you mean ${list(near)}?` : '';
    return `There is no preset called \`${name}\`.${hint} Run \`gspot explain <preset>\` to read one.`;
}

/**
 * Two presets whose manifests declare a conflict.
 * @param a the first preset id
 * @param b the second preset id
 * @returns the message
 */
export function presetConflict(a: string, b: string): string {
    return `The presets \`${a}\` and \`${b}\` cannot be selected together. Remove one with \`gspot remove <preset>\`.`;
}

/**
 * Requires that loop back on themselves.
 * @param chain the preset ids in the order they were followed
 * @returns the message
 */
export function circularRequires(chain: string[]): string {
    return `The presets require each other in a circle: ${chain.join(' -> ')}. This is a bug in a preset manifest.`;
}

/**
 * A scope whose directory is not there.
 * @param path the scope path as written
 * @returns the message
 */
export function scopeMissing(path: string): string {
    return `The scope \`${path}\` names a directory that does not exist. Scopes are directories under the repository root.`;
}

/**
 * One scope inside another.
 * @param outer the enclosing scope
 * @param inner the scope inside it
 * @returns the message
 */
export function scopesNest(outer: string, inner: string): string {
    return `The scope \`${inner}\` is inside the scope \`${outer}\`. Scopes do not nest; keep one of them.`;
}

/**
 * A setting key no selected preset exposes.
 * @param key the key as written
 * @param known the keys that exist under the same table
 * @returns the message
 */
export function settingNotExposed(key: string, known: string[]): string {
    return `No selected preset exposes \`${key}\`. The settings that exist under that table are ${list(known)}. Run \`gspot doctor --settings\` to see every one.`;
}

/**
 * A rule set to off through a setting instead of an ignore.
 * @param check the check that runs the rule
 * @param rule the rule name
 * @returns the message
 */
export function ruleOffRefused(check: string, rule: string): string {
    return `A rule is turned off with an ignore, not with \`off\`. Run: gspot ignore ${check} --rule ${rule} --reason "..."`;
}

/**
 * An extra option that a slot already covers.
 * @param tool the tool table
 * @param key the option name
 * @returns the message
 */
export function extraCoversSlot(tool: string, key: string): string {
    return `\`${key}\` under [tools.${tool}.extra] already has a slot. Move it up to \`tools.${tool}.${key}\` and remove it from extra.`;
}

/**
 * An extra table without its reason.
 * @param tool the tool table
 * @returns the message
 */
export function extraNeedsReason(tool: string): string {
    return `[tools.${tool}.extra] needs a \`reason\` saying which option has no slot yet. It prints on every run.`;
}

/**
 * A path selector that names a directory without a glob.
 * @param selector the selector as written
 * @returns the message
 */
export function bareDirectory(selector: string): string {
    return `The path \`${selector}\` names a directory. Write \`${selector}/**\` so it is clear that everything under it is meant.`;
}

/**
 * A key in the local file that belongs in the shared one.
 * @param key the key as written
 * @returns the message
 */
export function localOnlySkip(key: string): string {
    return `gspot.local.toml holds only \`skip\`. \`${key}\` belongs in gspot.toml.`;
}

/**
 * Two presets shipping different defaults for one scalar.
 * @param key the setting key
 * @param a the first preset id
 * @param b the second preset id
 * @returns the message
 */
export function conflictingScalars(key: string, a: string, b: string): string {
    return `The presets \`${a}\` and \`${b}\` set \`${key}\` to different values. Set it yourself in gspot.toml to decide.`;
}

/**
 * A value looser than the shipped default, written without a reason.
 * @param key the setting key
 * @param value the value as written, JSON encoded
 * @param shipped the shipped default, described
 * @param command the command line that carries the reason
 * @returns the message
 */
export function loosenNeedsReason(key: string, value: string, shipped: string, command: string): string {
    return `\`${key} = ${value}\` is looser than the shipped ${shipped}, so it needs a reason. Run: ${command}`;
}

/**
 * A naming term group that cannot be removed whole.
 * @param group the group name
 * @returns the message
 */
export function groupNotRemovable(group: string): string {
    return `The \`${group}\` term group cannot be removed. Allow one name at a time with \`gspot allow naming <name> --reason "..."\`.`;
}

/**
 * The pinned version and the running binary differ.
 * @param pinned the version the repository pins
 * @param running the version of this binary
 * @returns the message, with both ways forward
 */
export function versionMismatch(pinned: string, running: string): string {
    return [
        `This repository pins gspot ${pinned} and this binary is ${running}.`,
        "Two ways forward: install the pinned version (mise install, or your package manager's install),",
        `or move the pin to this version: gspot upgrade --to ${running}`,
    ].join('\n');
}

/**
 * A check id nothing ships.
 * @param id the id as written
 * @param near the closest ids that exist
 * @returns the message
 */
export function unknownCheck(id: string, near: string[]): string {
    const hint = near.length > 0 ? ` Did you mean ${list(near)}?` : '';
    return `There is no check called \`${id}\`.${hint}`;
}

/**
 * A value the schema refuses.
 * @param where the key or table
 * @param detail what is wrong with the value
 * @returns the message
 */
export function invalidValue(where: string, detail: string): string {
    return `${where}: ${detail}`;
}

/**
 * A policy file version this binary does not read.
 * @param version the version the file states
 * @returns the message
 */
export function versionUnsupported(version: number): string {
    return `gspot.toml says \`version = ${String(version)}\`, and this gspot reads version 1. Run \`gspot upgrade --check\` to see the way forward.`;
}

/**
 * A [[check]] entry missing one of its fields.
 * @param id the check id
 * @param field the missing field
 * @returns the message
 */
export function checkEntryIncomplete(id: string, field: string): string {
    return `The [[check]] entry \`${id}\` needs \`${field}\`. A check has an id, a command, paths and a stage.`;
}

/**
 * A limit key no check reads.
 * @param key the key as written
 * @param known the limits that exist
 * @returns the message
 */
export function limitUnknown(key: string, known: string[]): string {
    return `\`${key}\` is not a limit any check reads. The limits that exist are ${list(known)}.`;
}
