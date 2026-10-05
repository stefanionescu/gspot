// What a mise shim prints when no configuration in reach names a version of the tool.
export const NO_VERSION = 'No version is set for shim';

/** Numeric native floors allow an omitted minor or patch version. */
export const VERSION_FLOOR = /^(?:\d+|\d+\.\d+|\d+\.\d+\.\d+)$/u;
