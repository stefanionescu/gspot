export const VALE_PACKAGE_DECLARATIONS = [
    ['', []],
    ['Packages =\n', []],
    [' Packages=Google, Microsoft # selected styles\n', ['Google', 'Microsoft']],
    ['Packages = https://example.com/styles/LocalStyle.zip?version=1\n', ['LocalStyle']],
    ['Packages = Harper\n', ['Harper', 'config/dictionaries']],
    ['Packages = Retired\nPackages = Google\n', ['Google']],
    ['[*]\nPackages = ScopedStyle\nBasedOnStyles = LocalStyle\n', []],
] as const;
