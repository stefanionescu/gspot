import type { readReferenceData } from '#cli/reference.ts';

/**
 * Explain how to raise a limit, with a command, the written TOML, and the finding it accepts.
 *
 * @param data settings variants from the CLI
 * @returns the opening text of the limits page
 */
export function formatLimitsGuide(data: ReturnType<typeof readReferenceData>): string {
    const { setting } = data.settings.find(
        ({ setting }) => setting.name.startsWith('limits.') && setting.reason_needed === 'raising',
    ) as ReturnType<typeof readReferenceData>['settings'][number];
    const key = setting.name;
    const value = Number(setting.default) + 1;
    return (
        `Change a limit for the repository, or use \`limits.<language>.<name>\` for one language. A value that loosens a check needs a reason.\n\n` +
        `\`\`\`shell\ngspot set ${key} ${String(value)} --reason "The parser is one state machine."\n\`\`\`\n\n` +
        `\`\`\`toml\nconfigurations = ["bash"]\nlevel = "all"\n\n[limits]\n${key.slice('limits.'.length)} = { value = ${String(value)}, reason = "The parser is one state machine." }\n\`\`\`\n\n` +
        `For one language, set \`${key.replace('limits.', 'limits.bash.')}\` instead. Its recommended default is \`${JSON.stringify(setting.default)}\`.\n\n` +
        `For a Bash function over this nesting limit, \`bash/function-size\` reports:\n\n\`\`\`text\nmain has ${String(value)} levels of nesting, over the limit of ${String(setting.default)}.\n\`\`\`\n\n` +
        `The raised limit accepts that depth. To inspect the current value and source, run \`gspot explain ${key}\`.\n\n`
    );
}

/**
 * Explain the banned naming groups and how to accept one exact name.
 *
 * @param data settings variants from the CLI
 * @returns the opening text of the naming page
 */
export function formatNamingGuide(data: ReturnType<typeof readReferenceData>): string {
    const { setting } = data.settings.find(({ setting }) => setting.name === 'naming.max_words') as ReturnType<
        typeof readReferenceData
    >['settings'][number];
    const value = Number(setting.default) + 1;
    return (
        'Allow an exact name only when an external contract requires it. Every shipped banned naming group applies at level `all`. The `roles` group rejects vague job labels such as `helper` and `manager`; `defensive` rejects qualifiers such as `ensure` and `maybe`; `marketing` rejects claims such as `advanced` and `enhanced`. `naming.banned_words` adds project words.\n\n' +
        'For `export const helperCommand = 1;`, `naming/identifiers` reports:\n\n```text\njavascript variable "helperCommand": "helper" is banned (roles group).\n```\n\n' +
        'This complete example accepts that exact variable name in one file:\n\n```toml\nconfigurations = ["javascript", "naming"]\nlevel = "all"\n\n[[naming.override]]\npaths = ["helper.js"]\ncategories = ["variables"]\nallowed_names = ["helperCommand"]\nreason = "An external API requires this exact name."\n```\n\n' +
        'Write override records by hand, then run `gspot apply`. The override removes this `banned-word` finding; other names keep their checks.\n\n' +
        `To change the word limit, run:\n\n\`\`\`shell\ngspot set ${setting.name} ${String(value)} --reason "The public API uses five words."\n\`\`\`\n\n` +
        `The \`words\` finding reports identifiers over the default of ${String(setting.default)} words. The command permits ${String(value)} words.\n\n`
    );
}
