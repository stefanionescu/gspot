import type { Manifest, MiseBackend } from '#cli/types/configurations.ts';
import { CONFIGURATION_DIRECTORY } from '#cli/config/platform/locations.ts';

/** The rule assets within each shipped configuration. */
export const CONFIGURATION_RULES_FOLDER = 'rules';

/** The fields two configurations may set differently when both declare one setting. */
export const SETTING_DEFAULT_FIELDS = new Set(['default', 'default_all']);

export const SENTENCE_MIN_CHARS = 12;

export const CONFIG_PREFIX = `${CONFIGURATION_DIRECTORY}/`;

export const NAMING_TERMS_FILE = 'configurations/general/naming/policy.json';

/** Display labels for every validated configuration kind, in initialization order. */
export const CONFIGURATION_LABELS: Record<Manifest['configuration']['kind'], string> = {
    language: 'Languages',
    framework: 'Frameworks',
    platform: 'Platforms',
    database: 'Databases',
    tool: 'Tools',
    library: 'Libraries',
    general: 'Repository',
};

export const UV_INSTALLER = { name: 'uv', version: '0.12.13' };

export const MISE_BACKENDS: MiseBackend[] = [
    { installer: 'mise', prefix: '' },
    { installer: 'npm', prefix: 'npm:' },
    { installer: 'pypi', prefix: 'pipx:' },
    { installer: 'github', prefix: 'github:' },
    { installer: 'cargo', prefix: 'cargo:' },
];

/** Tool project trees owned and replaced as complete installations. */
export const INSTALLATION_KINDS = ['npm', 'python'] as const;

/** The npm backend that installs the published CLI. */
export const GSPOT_MISE_TOOL = 'npm:@gspothq/cli';

/** Release pins shared by CLI generation, installation, and pin validation. */
export const CLI_PINS = { mise: '2026.8.8' };

export const SETTING_PLACEHOLDER = /\{setting:(?<name>[a-z\d_.-]+)\}/gu;

export const CONFIG_PLACEHOLDER = /\{config:(?<name>[a-z0-9-]+)\}/gu;

export const POINTER_PLACEHOLDER = /\{pointer:(?<name>[^}]+)\}/gu;

export const WORKSPACE_PREFIX = '{workspace:';

export const EXISTING_PLACEHOLDER = /^\{existing:(?<flag>[^:]+):(?<path>[^}]+)\}$/u;

export const EACH_PLACEHOLDER = /^\{each:(?<flag>[^:]+):(?<setting>[a-z0-9_.-]+)\}$/u;

export const FILES_PLACEHOLDER = '{files}';

export const FILE_PLACEHOLDER = '{file}';
