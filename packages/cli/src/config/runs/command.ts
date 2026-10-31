import type { CheckStatus } from '#cli/types/runs/check.ts';

export const RAN_STATUSES = new Set<CheckStatus>(['passed', 'failed']);

export const WINDOWS_ESCAPE_EXPANSION = 5;

export const WINDOWS_ARGUMENT_OVERHEAD = 9;

export const WINDOWS_COMMAND_LIMIT = 7000;

export const UNIX_COMMAND_LIMIT = 100_000;

export const TOOL_ARGUMENTS_MESSAGE = 'Tool arguments exceed the command limit. Shorten the tool arguments.';

export const OUT_OF_MEMORY = /JavaScript heap out of memory|Reached heap limit/u;

export const TAIL_LINES = 20;

export const NO_ERROR_OUTPUT_MESSAGE = 'The tool printed no error output.';

export const OUT_OF_MEMORY_MESSAGE =
    'The tool ran out of memory. It most likely read build output or a bundle: keep that folder in .gitignore, or add an [[ignore]] with its paths.';

export const STACK_FRAME_LINE = /^\s+at /u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

export const CONFIG_PLACEHOLDER = /\{config_file:(?<name>[a-z0-9-]+)\}/gu;

export const LINK_FILE_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const LEVEL_PLACEHOLDER = /\{level:(?<defaultLevel>[^{}:]+):(?<all>[^{}:]+)\}/gu;

export const SCOPE_PLACEHOLDER = '{scope}';

export const ROOT_PLACEHOLDER = '{root}';

export const INDENT_PLACEHOLDER = '{indent}';

export const MESSAGE_FILE_PLACEHOLDER = '{message_file}';

export const SETTING_ONLY_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';
