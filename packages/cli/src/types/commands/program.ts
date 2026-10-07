import type { Command } from '@commander-js/extra-typings';
import type { VerbosityFlags } from '#cli/types/terminal.ts';

/** The flags every command takes, as commander parses them. */
export type GlobalFlags = VerbosityFlags & { json?: true; color: boolean; C?: string };

/** The program the commands register on, typed by its global flags. */
export type Program = Command<[], GlobalFlags>;
