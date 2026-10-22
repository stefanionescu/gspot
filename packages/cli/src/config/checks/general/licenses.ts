/** pip-licenses prints every license field it finds: the license expression, the metadata text, and the classifiers. */
export const PIP_LICENSES_COMMAND = ['pip-licenses', '--format=json', '--from=all', '--python'] as const;

export const LICENSE_CHECKER_COMMAND = [
    'license-checker-rseidelsohn',
    '--json',
    '--excludePrivatePackages',
    '--start',
] as const;

export const UNKNOWN_LICENSE = 'UNKNOWN';

export const LICENSE_CHOICE = ' OR ';

/** pip-licenses joins several classifiers of one package with this text. */
export const CLASSIFIER_SEPARATOR = '; ';

export const TROVE_LICENSES: Readonly<Record<string, string>> = {
    'MIT License': 'MIT',
    'Apache Software License': 'Apache-2.0',
    'BSD License': 'BSD-3-Clause',
    'ISC License (ISCL)': 'ISC',
    'Python Software Foundation License': 'PSF-2.0',
    'Mozilla Public License 2.0 (MPL 2.0)': 'MPL-2.0',
    'GNU Lesser General Public License v3 or later (LGPLv3+)': 'LGPL-3.0-or-later',
    'GNU Lesser General Public License v3 (LGPLv3)': 'LGPL-3.0-only',
    'GNU General Public License v3 (GPLv3)': 'GPL-3.0-only',
    'GNU General Public License v3 or later (GPLv3+)': 'GPL-3.0-or-later',
    'The Unlicense (Unlicense)': 'Unlicense',
    'Zope Public License': 'ZPL-2.1',
};

export const ANY_VERSION = '*';

export const PYTHON_LOCKFILES = ['uv.lock'] as const;
