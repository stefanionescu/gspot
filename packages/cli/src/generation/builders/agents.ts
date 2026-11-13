import { fromMarkdown } from 'mdast-util-from-markdown';
import { visit } from 'unist-util-visit';

import {
    BLANK_LINE,
    COMMANDS_HEADING,
    FOLDER_RULE_LINE,
    MARKDOWN_HEADING,
    RULE_OPENING_PREFIX,
    RULES_HEADING,
} from '#cli/config/generation/builders.ts';
import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { FIRST_READ } from '#cli/config/settings/validation.ts';
import { formatNameList } from '#cli/system/text/messages.ts';
import { compareText } from '#cli/system/text/order.ts';
import type { AgentsBlockContent, RuleFile } from '#cli/types/generation.ts';

function listIndexLines(files: RuleFile[]): string[] {
    return files
        .filter((file) => !FIRST_READ.includes(file.path))
        .map((file) => {
            const scopes = file.scopes.map((path) => `\`${path}/\``).join(', ');
            const scope = file.scopes.includes('') ? '' : ` in ${scopes}`;
            const opening = (file.content.split(BLANK_LINE) as [string, string, ...string[]])[1];
            const sentence = opening.replaceAll('\n', ' ').replace(RULE_OPENING_PREFIX, '');
            return `- \`${file.target}\`${scope}: ${sentence}`;
        })
        .toSorted(compareText);
}

function formatRulesIndex(files: RuleFile[]): string[] {
    const firstRead = FIRST_READ.map((path) => `\`${GSPOT_PATHS.rules}/${path}\``);
    return [
        `Read ${formatNameList(firstRead)} first.`,
        'Read a rule below when its sentence fits your task.',
        ...(files.some(({ scopes }) => !scopes.includes('')) ? [FOLDER_RULE_LINE] : []),
        'A more specific rule wins over a general one.',
        '',
        ...listIndexLines(files),
        '',
    ];
}

export function buildAgentsBlock({ files, startCommand, hasOwnTitle, hooksEnabled }: AgentsBlockContent): string {
    const index = files.length > 0 ? formatRulesIndex(files) : [];
    const lines = [
        RULES_HEADING,
        '',
        ...index,
        COMMANDS_HEADING,
        '',
        `The rules write \`gspot\` for \`${startCommand}\`.`,
        '',
        `Before you finish a change, stage it and run \`gspot check --staged --only commit\`. ${hooksEnabled ? 'When you commit, fix what the hook reports.' : 'Before you push, run `gspot check --base origin/HEAD`.'}`,
        '',
        'Change a setting with `gspot set`, `unset`, or `unignore`. Write the other `[[...]]` records by hand, after the user agrees, then run `gspot install`.',
        'When `gspot check` names a new configuration, ask the user, then run the `gspot add` line it prints and `gspot install`.',
        'Run `gspot ignore` or `gspot remove` only after the user agrees, with a reason.',
        'After you edit a package manifest or a tsconfig, run `gspot install`.',
        '',
        'Do not edit the files that gspot writes. `gspot/generated-files` reports an edit. Change `gspot.toml`, then run `gspot install`.',
    ];
    return (hasOwnTitle ? lines.map((line) => line.replace(MARKDOWN_HEADING, '#$1 ')) : lines).join('\n');
}

export function hasTopHeading(text: string): boolean {
    let isFound = false;
    visit(fromMarkdown(text), 'heading', (node) => {
        if (node.depth === 1) isFound = true;
    });
    return isFound;
}
