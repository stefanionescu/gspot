import { SETTINGS_FILE } from '#cli/config/settings/file.ts';
import { TSCONFIG_FILE } from '#cli/config/parsers/projects/tsconfig.ts';
import { PACKAGE_JSON, PYPROJECT_TOML } from '#cli/config/parsers/projects/dependencies.ts';

export const FILES_BETWEEN_PAUSES = 64;

export const COPY_ROOT_FILES = [SETTINGS_FILE, PACKAGE_JSON, TSCONFIG_FILE, PYPROJECT_TOML] as const;

export const DEPENDENCY_FILES: ReadonlySet<string> = new Set([PACKAGE_JSON, PYPROJECT_TOML]);
