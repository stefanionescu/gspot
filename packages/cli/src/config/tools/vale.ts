/** The upstream styles shipped at level all. */
export const VALE_PACKAGES = ['Google', 'Microsoft', 'write-good', 'proselint', 'alex', 'RedHat', 'Harper'];

/** Vale packages that also install shared files outside their style folder. */
export const PACKAGE_FOLDERS = { Harper: ['config/dictionaries'] };

/** Every folder required by the shipped upstream packages. */
export const VALE_PACKAGE_FOLDERS = [...VALE_PACKAGES, ...PACKAGE_FOLDERS.Harper];
