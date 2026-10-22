import { GROUPED_PBXPROJ } from '#tests/data/checks/xcode.ts';

export const XCODE_PROJECT_REFUSALS = [
    {
        name: 'missing value',
        source: GROUPED_PBXPROJ.slice(0, -3),
        message: 'The Xcode project has an invalid string.',
    },
    {
        name: 'unknown object',
        source: GROUPED_PBXPROJ.replace('B1, B2,', 'MISSING, B2,'),
        message: 'The Xcode project references an unknown object: MISSING.',
    },
    {
        name: 'group cycle',
        source: GROUPED_PBXPROJ.replace('children = (F1,);', 'children = (FIRST, F1,);').replace(
            'children = (FIRST, SECOND, ROOT, SYNC,);',
            'children = (SECOND, ROOT, SYNC,);',
        ),
        message: 'The Xcode project contains a group cycle.',
    },
    {
        name: 'unresolved source tree',
        source: GROUPED_PBXPROJ.replace('sourceTree = SOURCE_ROOT;', 'sourceTree = CUSTOM_BUILD_ROOT;'),
        message: 'Cannot find the folder of Xcode source tree CUSTOM_BUILD_ROOT without build settings.',
    },
] as const;

/** Project file syntax that the property-list reader must keep. */
export const PROJECT_SYNTAX_CASES = [
    { name: 'quoted keys', source: GROUPED_PBXPROJ.replace('rootObject = P;', '"rootObject" = P;') },
    {
        name: 'comments inside arrays',
        source: GROUPED_PBXPROJ.replace(
            'files = (B1, B2,);',
            'files = (B1, /* first source */ B2, // second source\n);',
        ),
    },
] as const;
