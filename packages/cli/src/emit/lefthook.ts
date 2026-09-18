// The gspot block in lefthook.yml, edited through the yaml document so the person's comments stay.
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { existsSync, readFileSync } from 'node:fs';
import type { LefthookBlock } from '#types/emit.ts';

/**
 * The file text with the gspot commands set under each hook.
 * @param existing the current lefthook.yml text, empty when there is none
 * @param block the commands per hook
 * @returns the new text
 */
export function lefthookText(existing: string, block: LefthookBlock): string {
    const document = parseDocument(existing.trim() === '' ? '{}' : existing);
    for (const [hook, { commands }] of Object.entries(block))
        for (const [name, command] of Object.entries(commands)) document.setIn([hook, 'commands', name], command);
    return document.toString();
}

/**
 * True when the file already holds every gspot command.
 * @param root the repository root
 * @param path the lefthook.yml path, relative to the root
 * @param block the commands per hook
 * @returns whether nothing needs writing
 */
export function isLefthookHeld(root: string, path: string, block: LefthookBlock): boolean {
    const full = join(root, path);
    if (!existsSync(full)) return false;
    const document = parseDocument(readFileSync(full, 'utf8'));
    return Object.entries(block).every(([hook, { commands }]) =>
        Object.entries(commands).every(
            ([name, command]) => JSON.stringify(document.getIn([hook, 'commands', name])) === JSON.stringify(command),
        ),
    );
}
