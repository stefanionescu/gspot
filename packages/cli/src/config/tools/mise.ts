import type { InstallationKind } from '#cli/types/tools/install.ts';
import { TOOL_PYTHON_PROJECT, TOOL_PACKAGE_PROJECT } from '#cli/config/platform/locations.ts';

export const MISE_MIN_VERSION = '2026.8.8';

/** The release archive backend for installing gspot without a JavaScript runtime. */
export const GSPOT_MISE_TOOL = 'github:stefanionescu/gspot';

/** Keep the executables and their required assets together at the installation root. */
export const GSPOT_MISE_OPTIONS = {
    asset_pattern: 'gspot-{{ version }}-{{ os(macos="darwin") }}-{{ arch() }}.tar.gz',
    strip_components: 1,
};

/** The generated project holding each private acquisition pin. */
export const PRIVATE_PIN_FILES: Record<InstallationKind, string> = {
    npm: TOOL_PACKAGE_PROJECT,
    python: TOOL_PYTHON_PROJECT,
};
