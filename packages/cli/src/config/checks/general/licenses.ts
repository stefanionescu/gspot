export const UNKNOWN_LICENSE = 'UNKNOWN';

export const LICENSE_CHOICE = ' OR ';

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

export const EMPTY_SCAN_MESSAGE =
    'The license scan found no packages. Install the selected project dependencies before scanning.';

export const NO_ALLOWED_LICENSES_NOTE = 'Set licenses.allowed to check licenses.';

export const RULES = { unusedRecord: 'unused-record', disallowedLicense: 'disallowed-license' } as const;
