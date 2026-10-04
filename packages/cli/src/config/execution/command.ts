export const COMMAND_CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const WORKSPACE_PREFIX = '{workspace:';

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const FILES_PLACEHOLDER = '{files}';

export const FILE_PLACEHOLDER = '{file}';

export const TAIL_LINES = 20;
