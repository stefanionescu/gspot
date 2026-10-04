import type { Command } from '@commander-js/extra-typings';

/** The flags every command takes, as commander parses them. */
export type GlobalFlags = { json?: true; quiet?: true; verbose?: true; color: boolean; C?: string };

/** The program the commands register on, typed by its global flags. */
export type Program = Command<[], GlobalFlags>;
