export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

export const CONFIG_FILE_PLACEHOLDER = /\{config_file:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const LEVEL_PLACEHOLDER = /\{level:(?<recommended>[^{}:]+):(?<all>[^{}:]+)\}/gu;

export const SCOPE_PLACEHOLDER = '{scope}';

export const ROOT_PLACEHOLDER = '{root}';

export const INDENT_PLACEHOLDER = '{indent}';

export const MESSAGE_FILE_PLACEHOLDER = '{message_file}';

export const SETTING_ONLY_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';
