import type { RuleDocs } from './types/plugin.ts';
import { PLUGIN_PREFIX } from './config/plugin.ts';
import { noInMisuse } from './rules/collections/no-in-misuse.ts';
import pluginPackage from '../package.json' with { type: 'json' };
import { noTryPromise } from './rules/promises/no-try-promise.ts';
import { noGlobalThis } from './rules/variables/no-global-this.ts';
import { tableHeader } from './rules/accessibility/table-header.ts';
import { noPathCommand } from './rules/security/no-path-command.ts';
import { preferLiteral } from './rules/variables/prefer-literal.ts';
import { noStatefulRegex } from './rules/regex/no-stateful-regex.ts';
import { preferTypeAlias } from './rules/types/prefer-type-alias.ts';
import { preferTypeGuard } from './rules/types/prefer-type-guard.ts';
import { noDetachedCall } from './rules/functions/no-detached-call.ts';
import { noIndexImports } from './rules/structure/no-index-imports.ts';
import { noTrivialFiles } from './rules/structure/no-trivial-files.ts';
import { noMagicNumbers } from './rules/variables/no-magic-numbers.ts';
import { requireServerOnly } from './rules/web/require-server-only.ts';
import { noSmallSwitch } from './rules/control-flow/no-small-switch.ts';
import { noIgnoredReturn } from './rules/functions/no-ignored-return.ts';
import { noEmptyRepetition } from './rules/regex/no-empty-repetition.ts';
import { noCommentedCode } from './rules/structure/no-commented-code.ts';
import { maxSwitchCases } from './rules/control-flow/max-switch-cases.ts';
import { noCompoundCase } from './rules/control-flow/no-compound-case.ts';
import { noIgnoredCatch } from './rules/control-flow/no-ignored-catch.ts';
import { noNestedSwitch } from './rules/control-flow/no-nested-switch.ts';
import { noInsecureRandom } from './rules/security/no-insecure-random.ts';
import { importBoundaries } from './rules/structure/import-boundaries.ts';
import { restrictedSyntax } from './rules/structure/restricted-syntax.ts';
import { noRedundantBoolean } from './rules/logic/no-redundant-boolean.ts';
import { maxRegexComplexity } from './rules/regex/max-regex-complexity.ts';
import { noAmbiguousAnchors } from './rules/regex/no-ambiguous-anchors.ts';
import { noInsecureCookies } from './rules/servers/no-insecure-cookies.ts';
import { noRenamedExports } from './rules/structure/no-renamed-exports.ts';
import { noClientEnvironment } from './rules/web/no-client-environment.ts';
import { noUnthrownError } from './rules/control-flow/no-unthrown-error.ts';
import { noPoweredByHeader } from './rules/servers/no-powered-by-header.ts';
import { noNestedFunctions } from './rules/functions/no-nested-functions.ts';
import { noIdenticalOperands } from './rules/logic/no-identical-operands.ts';
import { noNegatedComparison } from './rules/logic/no-negated-comparison.ts';
import { noRedundantOptional } from './rules/types/no-redundant-optional.ts';
import { noTableAsLayout } from './rules/accessibility/no-table-as-layout.ts';
import { noAsyncConstructor } from './rules/promises/no-async-constructor.ts';
import { noUnknownRegexGroup } from './rules/regex/no-unknown-regex-group.ts';
import { noEmptyCollection } from './rules/collections/no-empty-collection.ts';
import { noInvariantReturns } from './rules/functions/no-invariant-returns.ts';
import { noSwappedArguments } from './rules/functions/no-swapped-arguments.ts';
import { noTrivialFunctions } from './rules/functions/no-trivial-functions.ts';
import { preferReadonlyStatic } from './rules/types/prefer-readonly-static.ts';
import { redundantTypeAliases } from './rules/types/redundant-type-aliases.ts';
import { noDiscardedPostfix } from './rules/variables/no-discarded-postfix.ts';
import { noGlobalsShadowing } from './rules/variables/no-globals-shadowing.ts';
import { noEmptyReturnValue } from './rules/functions/no-empty-return-value.ts';
import { noMixedReturnTypes } from './rules/functions/no-mixed-return-types.ts';
import { noBitwiseInCondition } from './rules/logic/no-bitwise-in-condition.ts';
import { noLazyBeforeOptional } from './rules/regex/no-lazy-before-optional.ts';
import { noStringRegexPattern } from './rules/regex/no-string-regex-pattern.ts';
import { noElementOverwrite } from './rules/collections/no-element-overwrite.ts';
import { noUnusedCollection } from './rules/collections/no-unused-collection.ts';
import { noSelectorParameter } from './rules/functions/no-selector-parameter.ts';
import { noUndefinedArgument } from './rules/functions/no-undefined-argument.ts';
import { preferBooleanReturn } from './rules/functions/prefer-boolean-return.ts';
import { noUselessIntersection } from './rules/types/no-useless-intersection.ts';
import { noCommentsInImports } from './rules/structure/no-comments-in-imports.ts';
import { awsRules, testRules, securityRules, frameworkRules } from './registry.ts';
import { noSwitchCaseLabels } from './rules/control-flow/no-switch-case-labels.ts';
import { noIdenticalFunctions } from './rules/functions/no-identical-functions.ts';
import { noVoidArrayCallback } from './rules/collections/no-void-array-callback.ts';
import { noUnvalidatedJsonBody } from './rules/servers/no-unvalidated-json-body.ts';
import { noDuplicateInComposite } from './rules/types/no-duplicate-in-composite.ts';
import { noUnsafeSanitizerBypass } from './rules/web/no-unsafe-sanitizer-bypass.ts';
import { noGratuitousExpressions } from './rules/logic/no-gratuitous-expressions.ts';
import { noPublicTemporaryPath } from './rules/security/no-public-temporary-path.ts';
import { noKeywordDeclarations } from './rules/variables/no-keyword-declarations.ts';
import { noRedundantAssignment } from './rules/variables/no-redundant-assignment.ts';
import { preferImmediateReturn } from './rules/variables/prefer-immediate-return.ts';
import { noPositiveIndexCheck } from './rules/collections/no-positive-index-check.ts';
import { noDuplicatedBranches } from './rules/control-flow/no-duplicated-branches.ts';
import { noExcessCallArguments } from './rules/functions/no-excess-call-arguments.ts';
import { noFloatingPointEquality } from './rules/logic/no-floating-point-equality.ts';
import { preferPromiseShorthand } from './rules/promises/prefer-promise-shorthand.ts';
import { embedAlternativeText } from './rules/accessibility/embed-alternative-text.ts';
import { tableHeaderReference } from './rules/accessibility/table-header-reference.ts';
import { noEqualLoopCondition } from './rules/control-flow/no-equal-loop-condition.ts';
import { noUpdatedLoopCounter } from './rules/control-flow/no-updated-loop-counter.ts';
import { noTransposedAssignment } from './rules/variables/no-transposed-assignment.ts';
import { noShallowCloneMutation } from './rules/libraries/no-shallow-clone-mutation.ts';
import { noUnsafeSecurityHeaders } from './rules/servers/no-unsafe-security-headers.ts';
import { noAdjacentMultilineIf } from './rules/control-flow/no-adjacent-multiline-if.ts';
import { noMisplacedLoopCounter } from './rules/control-flow/no-misplaced-loop-counter.ts';
import { noNestedTemplateLiterals } from './rules/structure/no-nested-template-literals.ts';
import { noMisleadingArrayReverse } from './rules/collections/no-misleading-array-reverse.ts';
import { requireReduceInitialValue } from './rules/collections/require-reduce-initial-value.ts';
import { noInconsistentFunctionCall } from './rules/functions/no-inconsistent-function-call.ts';
import { noImpossibleCollectionSize } from './rules/collections/no-impossible-collection-size.ts';
import { noUnenclosedMultilineBlock } from './rules/control-flow/no-unenclosed-multiline-block.ts';

const rules = {
    ...testRules,
    ...frameworkRules,
    ...securityRules,
    ...awsRules,
    'no-void-array-callback': noVoidArrayCallback,
    'no-redundant-assignment': noRedundantAssignment,
    'no-shallow-clone-mutation': noShallowCloneMutation,
    'no-mixed-return-types': noMixedReturnTypes,
    'no-selector-parameter': noSelectorParameter,
    'no-swapped-arguments': noSwappedArguments,
    'no-gratuitous-expressions': noGratuitousExpressions,
    'no-unused-collection': noUnusedCollection,
    'no-empty-collection': noEmptyCollection,
    'no-identical-functions': noIdenticalFunctions,
    'no-unknown-regex-group': noUnknownRegexGroup,
    'no-stateful-regex': noStatefulRegex,
    'no-lazy-before-optional': noLazyBeforeOptional,
    'max-regex-complexity': maxRegexComplexity,
    'no-ambiguous-anchors': noAmbiguousAnchors,
    'no-empty-repetition': noEmptyRepetition,
    'no-string-regex-pattern': noStringRegexPattern,
    'no-useless-intersection': noUselessIntersection,
    'no-redundant-optional': noRedundantOptional,
    'prefer-promise-shorthand': preferPromiseShorthand,
    'prefer-type-guard': preferTypeGuard,
    'prefer-type-alias': preferTypeAlias,
    'no-duplicate-in-composite': noDuplicateInComposite,
    'no-ignored-return': noIgnoredReturn,
    'no-misleading-array-reverse': noMisleadingArrayReverse,
    'no-positive-index-check': noPositiveIndexCheck,
    'no-async-constructor': noAsyncConstructor,
    'no-try-promise': noTryPromise,
    'require-reduce-initial-value': requireReduceInitialValue,
    'no-undefined-argument': noUndefinedArgument,
    'no-in-misuse': noInMisuse,
    'no-globals-shadowing': noGlobalsShadowing,
    'no-nested-functions': noNestedFunctions,
    'no-inconsistent-function-call': noInconsistentFunctionCall,
    'no-invariant-returns': noInvariantReturns,
    'no-element-overwrite': noElementOverwrite,
    'no-unenclosed-multiline-block': noUnenclosedMultilineBlock,
    'no-updated-loop-counter': noUpdatedLoopCounter,
    'no-misplaced-loop-counter': noMisplacedLoopCounter,
    'no-duplicated-branches': noDuplicatedBranches,
    'no-bitwise-in-condition': noBitwiseInCondition,
    'no-floating-point-equality': noFloatingPointEquality,
    'no-equal-loop-condition': noEqualLoopCondition,
    'no-small-switch': noSmallSwitch,
    'no-unvalidated-json-body': noUnvalidatedJsonBody,
    'no-discarded-postfix': noDiscardedPostfix,
    'no-ignored-catch': noIgnoredCatch,
    'no-keyword-declarations': noKeywordDeclarations,
    'no-adjacent-multiline-if': noAdjacentMultilineIf,
    'no-detached-call': noDetachedCall,
    'no-redundant-boolean': noRedundantBoolean,
    'no-compound-case': noCompoundCase,
    'no-unsafe-sanitizer-bypass': noUnsafeSanitizerBypass,
    'no-path-command': noPathCommand,
    'no-public-temporary-path': noPublicTemporaryPath,
    'no-identical-operands': noIdenticalOperands,
    'no-global-this': noGlobalThis,
    'no-negated-comparison': noNegatedComparison,
    'prefer-boolean-return': preferBooleanReturn,
    'no-impossible-collection-size': noImpossibleCollectionSize,
    'no-excess-call-arguments': noExcessCallArguments,
    'no-empty-return-value': noEmptyReturnValue,
    'max-switch-cases': maxSwitchCases,
    'no-unthrown-error': noUnthrownError,
    'no-transposed-assignment': noTransposedAssignment,
    'no-nested-template-literals': noNestedTemplateLiterals,
    'no-switch-case-labels': noSwitchCaseLabels,
    'prefer-readonly-static': preferReadonlyStatic,
    'no-comments-in-imports': noCommentsInImports,
    'no-client-environment': noClientEnvironment,
    'no-powered-by-header': noPoweredByHeader,
    'no-insecure-random': noInsecureRandom,
    'no-unsafe-security-headers': noUnsafeSecurityHeaders,
    'no-insecure-cookies': noInsecureCookies,
    'import-boundaries': importBoundaries,
    'no-renamed-exports': noRenamedExports,
    'no-index-imports': noIndexImports,
    'no-magic-numbers': noMagicNumbers,
    'no-trivial-files': noTrivialFiles,
    'no-nested-switch': noNestedSwitch,
    'prefer-object-literal': preferLiteral,
    'prefer-immediate-return': preferImmediateReturn,
    'redundant-type-aliases': redundantTypeAliases,
    'no-commented-code': noCommentedCode,
    'no-trivial-functions': noTrivialFunctions,
    'restricted-syntax': restrictedSyntax,
    'require-server-only': requireServerOnly,
    'table-header': tableHeader,
    'table-header-reference': tableHeaderReference,
    'no-table-as-layout': noTableAsLayout,
    'embed-alternative-text': embedAlternativeText,
};

const selectLevelRules = (levels: ReadonlyArray<RuleDocs['level']>) =>
    Object.fromEntries(
        Object.entries(rules)
            .filter(([, rule]) => rule.meta.docs !== undefined && levels.includes(rule.meta.docs.level))
            .map(([name]) => [`${PLUGIN_PREFIX}/${name}`, 'error' as const]),
    );

const plugin = {
    meta: { name: pluginPackage.name, version: pluginPackage.version },
    rules,
};

export default Object.assign(plugin, {
    configs: {
        recommended: {
            name: `${PLUGIN_PREFIX}/recommended`,
            plugins: { [PLUGIN_PREFIX]: plugin },
            rules: selectLevelRules(['recommended']),
        },
        all: {
            name: `${PLUGIN_PREFIX}/all`,
            plugins: { [PLUGIN_PREFIX]: plugin },
            rules: selectLevelRules(['recommended', 'all']),
        },
    },
});
