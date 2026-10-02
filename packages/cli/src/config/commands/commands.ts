// The literal values commands reads: names, patterns, limits, and tables.
import type { ErrorCode } from '#cli/types/platform/platform.ts';

export const SET_NEAR_LIMIT = 12;
export const RULE_KEY_DEPTH = 3;
export const INTEGER = /^-?\d+$/u;
export const DECIMAL = /^-?\d+\.\d+$/u;

// An opening bracket identifies an intended list or table even without a closing bracket.
export const STRUCTURED = /^[[{]/u;
export const HELP_CODES = new Set(['commander.helpDisplayed', 'commander.version', 'commander.help']);
export const KNOWN_ERRORS = new Set<ErrorCode>(['policy', 'selection', 'manifest', 'pin', 'prompt', 'profile']);
export const KEY_GAP = 2;
export const VALUE_WIDTH = 28;
