// Every load and write message, in plain English. One function per message.

function list(items: string[], limit = 8): string {
    const shown = items.slice(0, limit);
    const rest = items.length - shown.length;
    return shown.map((item) => `\`${item}\``).join(', ') + (rest > 0 ? ` and ${rest} more` : '');
}

export function fileMissing(path: string): string {
    return `There is no ${path} here. Run \`gspot init\` to create one.`;
}

export function tomlSyntax(path: string, detail: string): string {
    return `${path} is not valid TOML: ${detail}`;
}

export function unknownKey(where: string, key: string, known: string[]): string {
    const table = where === '' ? 'the top level' : `[${where}]`;
    return `\`${key}\` is not a setting gspot knows under ${table}. The keys that exist there are ${list(known)}.`;
}

export function refusedReason(where: string, reason: string): string {
    const shown = reason.trim() === '' ? 'an empty reason' : `"${reason}"`;
    return `${where} needs a reason that says something: ${shown} is refused. Write one sentence saying why.`;
}

export function missingReason(where: string, command: string): string {
    return `${where} needs a reason. Add \`reason = "..."\` or run: ${command}`;
}

export function unknownPreset(name: string, near: string[]): string {
    const hint = near.length > 0 ? ` Did you mean ${list(near)}?` : '';
    return `There is no preset called \`${name}\`.${hint} Run \`gspot explain <preset>\` to read one.`;
}

export function presetConflict(a: string, b: string): string {
    return `The presets \`${a}\` and \`${b}\` cannot be selected together. Remove one with \`gspot remove <preset>\`.`;
}

export function circularRequires(chain: string[]): string {
    return `The presets require each other in a circle: ${chain.join(' -> ')}. This is a bug in a preset manifest.`;
}

export function scopeMissing(path: string): string {
    return `The scope \`${path}\` names a directory that does not exist. Scopes are directories under the repository root.`;
}

export function scopesNest(outer: string, inner: string): string {
    return `The scope \`${inner}\` is inside the scope \`${outer}\`. Scopes do not nest; keep one of them.`;
}

export function settingNotExposed(key: string, known: string[]): string {
    return `No selected preset exposes \`${key}\`. The settings that exist under that table are ${list(known)}. Run \`gspot doctor --settings\` to see every one.`;
}

export function ruleOffRefused(check: string, rule: string): string {
    return `A rule is turned off with an ignore, not with \`off\`. Run: gspot ignore ${check} --rule ${rule} --reason "..."`;
}

export function extraCoversSlot(tool: string, key: string): string {
    return `\`${key}\` under [tools.${tool}.extra] already has a slot. Move it up to \`tools.${tool}.${key}\` and remove it from extra.`;
}

export function extraNeedsReason(tool: string): string {
    return `[tools.${tool}.extra] needs a \`reason\` saying which option has no slot yet. It prints on every run.`;
}

export function bareDirectory(selector: string): string {
    return `The path \`${selector}\` names a directory. Write \`${selector}/**\` so it is clear that everything under it is meant.`;
}

export function localOnlySkip(key: string): string {
    return `gspot.local.toml holds only \`skip\`. \`${key}\` belongs in gspot.toml.`;
}

export function conflictingScalars(key: string, a: string, b: string): string {
    return `The presets \`${a}\` and \`${b}\` set \`${key}\` to different values. Set it yourself in gspot.toml to decide.`;
}

export function loosenNeedsReason(key: string, value: string, shipped: string, command: string): string {
    return `\`${key} = ${value}\` is looser than the shipped ${shipped}, so it needs a reason. Run: ${command}`;
}

export function groupNotRemovable(group: string): string {
    return `The \`${group}\` term group cannot be removed. Allow one name at a time with \`gspot allow naming <name> --reason "..."\`.`;
}

export function versionMismatch(pinned: string, running: string): string {
    return [
        `This repository pins gspot ${pinned} and this binary is ${running}.`,
        "Two ways forward: install the pinned version (mise install, or your package manager's install),",
        `or move the pin to this version: gspot upgrade --to ${running}`,
    ].join('\n');
}

export function unknownCheck(id: string, near: string[]): string {
    const hint = near.length > 0 ? ` Did you mean ${list(near)}?` : '';
    return `There is no check called \`${id}\`.${hint}`;
}

export function invalidValue(where: string, detail: string): string {
    return `${where}: ${detail}`;
}

export function versionUnsupported(version: number): string {
    return `gspot.toml says \`version = ${version}\`, and this gspot reads version 1. Run \`gspot upgrade --check\` to see the way forward.`;
}

export function checkEntryIncomplete(id: string, field: string): string {
    return `The [[check]] entry \`${id}\` needs \`${field}\`. A check has an id, a command, paths and a stage.`;
}

export function limitUnknown(key: string, known: string[]): string {
    return `\`${key}\` is not a limit any check reads. The limits that exist are ${list(known)}.`;
}
