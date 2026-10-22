/** The placeholder that a manifest file list uses for the resolved test files of the scope. */
export const TEST_FILES_PLACEHOLDER = '{setting:test_files}';

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const CONFIG_FILE_PLACEHOLDER = /\{config_file:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const WORKSPACE_PLACEHOLDER = /^\{workspace:(?<name>[^}]+)\}$/u;

export const WHOLE_SETTING_PLACEHOLDER = /^\{setting:(?<name>[a-z\d_.-]+)\}$/u;

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';

export const FILE_PLACEHOLDER = '{file}';

export const ROOT_PLACEHOLDER = '{root}';

export const SCOPE_PLACEHOLDER = '{scope}';

export const INDENT_PLACEHOLDER = '{indent}';

export const MESSAGE_FILE_PLACEHOLDER = '{message_file}';

export const LEVEL_PLACEHOLDER = /\{level:(?<recommended>[^{}:]+):(?<all>[^{}:]+)\}/gu;

export const TARGET_MODULE_PLACEHOLDER = '{target_module}';

export const TARGET_JSON_PLACEHOLDER = '{target_json}';

export const RULE_PLACEHOLDER = '{rule}';

export const TARGET_PLACEHOLDER = /\{target(?:_json|_module)?\}/gu;
