import { stripRuntimeGlobals, mergePresetRules, addPlugins, setRootFolder, setImportLookup } from "../javascript/eslint/functions.mjs";
import typescriptEslint from "typescript-eslint";
import globals from "globals";
import { createTypeScriptImportResolver } from "eslint-import-resolver-typescript";
const ignoresList = [
    "docs/**"
];
const typescriptEslintNoMisusedSpreadList = [
    "error",
    {
        "allow": [
            "string"
        ]
    }
];
const typescriptEslintNoUnnecessaryConditionList = [
    "error",
    {
        "checkTypePredicates": true
    }
];
const jsdocCheckTagNamesList = [
    "error",
    {
        "typed": true
    }
];
const typescriptEslintConsistentTypeDefinitionsList = [
    "error",
    "type"
];
const importXNoDuplicatesList = [
    "error",
    {
        "prefer-inline": true
    }
];
const typescriptEslintSwitchExhaustivenessCheckList = [
    "error",
    {
        "considerDefaultExhaustiveForUnions": true
    }
];
const typescriptEslintNoFloatingPromisesList = [
    "error",
    {
        "ignoreVoid": false
    }
];
const typescriptEslintNoUnusedVarsList = [
    "error",
    {
        "args": "all",
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_",
        "ignoreUsingDeclarations": true
    }
];
const typescriptEslintRestrictTemplateExpressionsList = [
    "error",
    {
        "allowAny": false,
        "allowBoolean": false,
        "allowNever": false,
        "allowNullish": false,
        "allowNumber": true,
        "allowRegExp": false
    }
];
const typescriptEslintArrayTypeList = [
    "error",
    {
        "default": "array-simple"
    }
];
const typescriptEslintConsistentTypeAssertionsList = [
    "error",
    {
        "assertionStyle": "as",
        "objectLiteralTypeAssertions": "never",
        "arrayLiteralTypeAssertions": "never"
    }
];
const gspotNoMagicNumbersList = [
    "error",
    {
        "ignoreEnums": true,
        "ignoreArrayIndexes": true,
        "ignoreReadonlyClassProperties": true,
        "ignoreTypeIndexes": true,
        "ignore": [
            -1,
            0,
            1
        ]
    }
];
const typescriptEslintBanTsCommentList = [
    "error",
    {
        "ts-expect-error": false
    }
];
const typescriptEslintParserList = [
    ".ts",
    ".tsx",
    ".mts",
    ".cts"
];
export default [
    {"ignores": ignoresList,
    "extends": [stripRuntimeGlobals(typescriptEslint["configs"]["base"], globals)],
    "files": [["**/*.{ts,mts,cts,tsx}", "**/*"]]},
    mergePresetRules({"ignores": ignoresList,
    "files": [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]}, typescriptEslint["configs"]["strictTypeChecked"]),
    setImportLookup(setRootFolder(addPlugins({"rules": {
        "no-const-assign": "error",
        "@typescript-eslint/no-misused-spread": typescriptEslintNoMisusedSpreadList,
        "@typescript-eslint/no-unnecessary-condition": typescriptEslintNoUnnecessaryConditionList,
        "jsdoc/require-param-type": "off",
        "jsdoc/require-returns-type": "off",
        "jsdoc/check-types": "off",
        "jsdoc/no-undefined-types": "off",
        "jsdoc/valid-types": "off",
        "jsdoc/no-types": "error",
        "jsdoc/check-tag-names": jsdocCheckTagNamesList,
        "@typescript-eslint/consistent-type-definitions": typescriptEslintConsistentTypeDefinitionsList,
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-import-type-side-effects": "error",
        "@typescript-eslint/dot-notation": "error",
        "import-x/no-duplicates": importXNoDuplicatesList,
        "@typescript-eslint/consistent-type-exports": "error",
        "@typescript-eslint/switch-exhaustiveness-check": typescriptEslintSwitchExhaustivenessCheckList,
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/require-array-sort-compare": "error",
        "unicorn/require-array-sort-compare": "off",
        "unicorn/no-useless-coercion": "off",
        "@typescript-eslint/no-floating-promises": typescriptEslintNoFloatingPromisesList,
        "@typescript-eslint/no-unused-vars": typescriptEslintNoUnusedVarsList,
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/strict-boolean-expressions": "error",
        "@typescript-eslint/restrict-template-expressions": typescriptEslintRestrictTemplateExpressionsList,
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/array-type": typescriptEslintArrayTypeList,
        "@typescript-eslint/consistent-type-assertions": typescriptEslintConsistentTypeAssertionsList,
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "gspot/no-magic-numbers": gspotNoMagicNumbersList,
        "@typescript-eslint/ban-ts-comment": typescriptEslintBanTsCommentList
    },
    "settings": {
        "import-x/parsers": {
            "@typescript-eslint/parser": typescriptEslintParserList
        }
    },
    "ignores": ignoresList,
    "files": [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]}, { "@typescript-eslint": typescriptEslint["plugin"] }), [
        [
            "languageOptions",
            "parserOptions",
            "tsconfigRootDir"
        ]
    ]), createTypeScriptImportResolver, [
        "docs/tsconfig.json",
        "packages/cli/tsconfig.json",
        "packages/eslint-plugin/tsconfig.json",
        "tsconfig.json"
    ]),
    {"languageOptions": {
        "parserOptions": {
            "projectService": true
        }
    },
    "ignores": [
        "**/*.astro",
        "docs/**"
    ],
    "files": [["**/*.{ts,mts,cts,tsx}", "**/*"], ["**/*.astro", "**/*"]]},
    {"rules": {
        "gspot/no-magic-numbers": "off",
        "@typescript-eslint/no-non-null-assertion": "off"
    },
    "ignores": ignoresList,
    "files": [["**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/test/**", "**/*.astro", "**/*"], ["**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/tests/**", "**/*.astro", "**/*"], ["**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/__tests__/**", "**/*.astro", "**/*"], ["**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*.test.*", "**/*.astro", "**/*"], ["**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/*.spec.*", "**/*.astro", "**/*"], ["**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "**/*"], ["**/Tests/**", "**/*.astro", "**/*"]]},
    {"extends": [stripRuntimeGlobals(typescriptEslint["configs"]["base"], globals)],
    "files": [["**/*.{ts,mts,cts,tsx}", "docs/**/*"]]},
    mergePresetRules({"files": [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}, typescriptEslint["configs"]["strictTypeChecked"]),
    setImportLookup(setRootFolder(addPlugins({"rules": {
        "no-const-assign": "error",
        "@typescript-eslint/no-misused-spread": typescriptEslintNoMisusedSpreadList,
        "@typescript-eslint/no-unnecessary-condition": typescriptEslintNoUnnecessaryConditionList,
        "jsdoc/require-param-type": "off",
        "jsdoc/require-returns-type": "off",
        "jsdoc/check-types": "off",
        "jsdoc/no-undefined-types": "off",
        "jsdoc/valid-types": "off",
        "jsdoc/no-types": "error",
        "jsdoc/check-tag-names": jsdocCheckTagNamesList,
        "@typescript-eslint/consistent-type-definitions": typescriptEslintConsistentTypeDefinitionsList,
        "@typescript-eslint/consistent-type-imports": "error",
        "@typescript-eslint/no-import-type-side-effects": "error",
        "@typescript-eslint/dot-notation": "error",
        "import-x/no-duplicates": importXNoDuplicatesList,
        "@typescript-eslint/consistent-type-exports": "error",
        "@typescript-eslint/switch-exhaustiveness-check": typescriptEslintSwitchExhaustivenessCheckList,
        "@typescript-eslint/prefer-readonly": "error",
        "@typescript-eslint/require-array-sort-compare": "error",
        "unicorn/require-array-sort-compare": "off",
        "unicorn/no-useless-coercion": "off",
        "@typescript-eslint/no-floating-promises": typescriptEslintNoFloatingPromisesList,
        "@typescript-eslint/no-unused-vars": typescriptEslintNoUnusedVarsList,
        "@typescript-eslint/no-require-imports": "off",
        "@typescript-eslint/strict-boolean-expressions": "error",
        "@typescript-eslint/restrict-template-expressions": typescriptEslintRestrictTemplateExpressionsList,
        "@typescript-eslint/explicit-module-boundary-types": "error",
        "@typescript-eslint/prefer-optional-chain": "error",
        "@typescript-eslint/array-type": typescriptEslintArrayTypeList,
        "@typescript-eslint/consistent-type-assertions": typescriptEslintConsistentTypeAssertionsList,
        "@typescript-eslint/prefer-nullish-coalescing": "error",
        "gspot/no-magic-numbers": gspotNoMagicNumbersList,
        "@typescript-eslint/ban-ts-comment": typescriptEslintBanTsCommentList
    },
    "settings": {
        "import-x/parsers": {
            "@typescript-eslint/parser": typescriptEslintParserList
        }
    },
    "files": [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]}, { "@typescript-eslint": typescriptEslint["plugin"] }), [
        [
            "languageOptions",
            "parserOptions",
            "tsconfigRootDir"
        ]
    ]), createTypeScriptImportResolver, [
        "docs/tsconfig.json",
        "packages/cli/tsconfig.json",
        "packages/eslint-plugin/tsconfig.json",
        "tsconfig.json"
    ]),
    {"languageOptions": {
        "parserOptions": {
            "projectService": true
        }
    },
    "ignores": [
        "**/*.astro"
    ],
    "files": [["**/*.{ts,mts,cts,tsx}", "docs/**/*"], ["**/*.astro", "docs/**/*"]]},
    {"rules": {
        "gspot/no-magic-numbers": "off",
        "@typescript-eslint/no-non-null-assertion": "off"
    },
    "files": [["**/test/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/test/**", "**/*.astro", "docs/**/*"], ["**/tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/tests/**", "**/*.astro", "docs/**/*"], ["**/__tests__/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/__tests__/**", "**/*.astro", "docs/**/*"], ["**/*.test.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/*.test.*", "**/*.astro", "docs/**/*"], ["**/*.spec.*", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/*.spec.*", "**/*.astro", "docs/**/*"], ["**/Tests/**", "**/*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}", "docs/**/*"], ["**/Tests/**", "**/*.astro", "docs/**/*"]]},
    {"extends": [stripRuntimeGlobals(typescriptEslint["configs"]["disableTypeChecked"], globals)],
    "files": [["**/*.astro/*.ts", "docs/**/*"], ["**/*.astro/*.js", "docs/**/*"]]},
];
