import { GSPOT_PATHS } from '#cli/config/manifests.ts';
import { BYTES_PER_MEGABYTE } from '#cli/config/system.ts';

// vale install
export const VALE_ARCHIVE_LIMIT = 8 * BYTES_PER_MEGABYTE;
export const VALE_DOWNLOAD_NAME = 'the Vale package';
export const VALE_INSTALL_ARGUMENTS = ['sync'] as const;
export const VALE_INSTALL_STEP = 'Vale sync';
export const VALE_PACKAGE_RELEASES = {
    Google: { version: 'v0.7.1', sha256: '4b67fca1f2a88595b2a578ab98bbf3017a23af677b04f93e862843f3ea1a9a0b' },
    'write-good': { version: 'v0.4.1', sha256: '2960ef10861ddc7dc76292a4967eb3789bf05ca24f862042f6d15f53332887f0' },
    proselint: { version: 'v0.3.4', sha256: '48b1fb481ba44f6505d44346b283f6cdc74efd234f913bbdb09bf34420fab81c' },
    alex: { version: 'v0.2.3', sha256: '44014c7f63d4a8bce86788e074edb80333a9b6eba07e5dd27b24823b69eed50b' },
    Harper: { version: 'v0.1.0', sha256: 'bfab282e7abd8906f8656c240ccd4d873679878ed8e0c42d683ad7e2798c436c' },
} as const;
export const VALE_PACKAGES = Object.keys(VALE_PACKAGE_RELEASES) as Array<keyof typeof VALE_PACKAGE_RELEASES>;
export const VALE_PACKAGES_MESSAGE = 'The Vale packages are not installed. Run gspot install.';
export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, 'config/dictionaries'] as const;
const VALE_PACKAGE_REPOSITORY = 'https://github.com/vale-cli/';
export const VALE_PACKAGE_URLS = Object.fromEntries(
    VALE_PACKAGES.map((name) => [
        name,
        `${VALE_PACKAGE_REPOSITORY}${name}/releases/download/${VALE_PACKAGE_RELEASES[name].version}/${name}.zip`,
    ]),
) as Record<(typeof VALE_PACKAGES)[number], string>;
export const VALE_TOOL = 'vale';

// vale rules
export const VALE_RULE_IDENTIFIER = /^[\w-]+\.[\w-]+$/u;
export const VALE_STYLES_PATH = `${GSPOT_PATHS.configurations}/prose/styles`;
