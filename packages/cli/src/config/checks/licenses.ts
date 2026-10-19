export const LICENSE_CHECKER = 'license-checker-rseidelsohn';

export const LICENSE_CHECKER_ARGUMENTS = ['--json', '--excludePrivatePackages', '--start'] as const;
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

/** An exact package version such as 2.0.0.post1, a semver range such as ^1.2.0 or >=1 <2, or * for every version. */
export const ALLOWED_VERSION = /^(?:\*|\d[^\s@<>=~^*|,]*|[\d.xX*^~<>=|\s-]+)$/u;
