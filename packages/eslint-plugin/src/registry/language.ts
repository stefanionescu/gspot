import { noInMisuse } from '../rules/collections/no-in-misuse.ts';
import { noTryPromise } from '../rules/promises/no-try-promise.ts';
import { noDetachedCall } from '../rules/layout/no-detached-call.ts';
import { noStatefulRegex } from '../rules/regex/no-stateful-regex.ts';
import { preferTypeAlias } from '../rules/types/prefer-type-alias.ts';
import { preferTypeGuard } from '../rules/types/prefer-type-guard.ts';
import { noIndexImports } from '../rules/structure/no-index-imports.ts';
import { noTrivialFiles } from '../rules/structure/no-trivial-files.ts';
import { noMagicNumbers } from '../rules/variables/no-magic-numbers.ts';
import { noCommentedCode } from '../rules/comments/no-commented-code.ts';
import { noSmallSwitch } from '../rules/control-flow/no-small-switch.ts';
import { noIgnoredReturn } from '../rules/functions/no-ignored-return.ts';
import { noEmptyRepetition } from '../rules/regex/no-empty-repetition.ts';
import { maxSwitchCases } from '../rules/control-flow/max-switch-cases.ts';
import { noCompoundCase } from '../rules/control-flow/no-compound-case.ts';
import { noIgnoredCatch } from '../rules/control-flow/no-ignored-catch.ts';
import { noNestedSwitch } from '../rules/control-flow/no-nested-switch.ts';
import { importBoundaries } from '../rules/structure/import-boundaries.ts';
import { restrictedSyntax } from '../rules/structure/restricted-syntax.ts';
import { noRedundantBoolean } from '../rules/logic/no-redundant-boolean.ts';
import { maxRegexComplexity } from '../rules/regex/max-regex-complexity.ts';
import { noAmbiguousAnchors } from '../rules/regex/no-ambiguous-anchors.ts';
import { noRenamedExports } from '../rules/structure/no-renamed-exports.ts';
import { noRenamedImports } from '../rules/structure/no-renamed-imports.ts';
import { noUnthrownError } from '../rules/control-flow/no-unthrown-error.ts';
import { noNestedFunctions } from '../rules/functions/no-nested-functions.ts';
import { noIdenticalOperands } from '../rules/logic/no-identical-operands.ts';
import { noNegatedComparison } from '../rules/logic/no-negated-comparison.ts';
import { noRedundantOptional } from '../rules/types/no-redundant-optional.ts';
import { noAsyncConstructor } from '../rules/promises/no-async-constructor.ts';
import { noUnknownRegexGroup } from '../rules/regex/no-unknown-regex-group.ts';
import { noEmptyCollection } from '../rules/collections/no-empty-collection.ts';
import { noInvariantReturns } from '../rules/functions/no-invariant-returns.ts';
import { noSwappedArguments } from '../rules/functions/no-swapped-arguments.ts';
import { noTrivialFunctions } from '../rules/functions/no-trivial-functions.ts';
import { preferReadonlyStatic } from '../rules/types/prefer-readonly-static.ts';
import { redundantTypeAliases } from '../rules/types/redundant-type-aliases.ts';
import { noDiscardedPostfix } from '../rules/variables/no-discarded-postfix.ts';
import { noGlobalsShadowing } from '../rules/variables/no-globals-shadowing.ts';
import { noEmptyReturnValue } from '../rules/functions/no-empty-return-value.ts';
import { noMixedReturnTypes } from '../rules/functions/no-mixed-return-types.ts';
import { noBitwiseInCondition } from '../rules/logic/no-bitwise-in-condition.ts';
import { noLazyBeforeOptional } from '../rules/regex/no-lazy-before-optional.ts';
import { noStringRegexPattern } from '../rules/regex/no-string-regex-pattern.ts';
import { noElementOverwrite } from '../rules/collections/no-element-overwrite.ts';
import { noUnusedCollection } from '../rules/collections/no-unused-collection.ts';
import { noCommentsInImports } from '../rules/comments/no-comments-in-imports.ts';
import { noBooleanParameters } from '../rules/functions/no-boolean-parameters.ts';
import { noSelectorParameter } from '../rules/functions/no-selector-parameter.ts';
import { noUndefinedArgument } from '../rules/functions/no-undefined-argument.ts';
import { noUselessIntersection } from '../rules/types/no-useless-intersection.ts';
import { noSwitchCaseLabels } from '../rules/control-flow/no-switch-case-labels.ts';
import { noIdenticalFunctions } from '../rules/functions/no-identical-functions.ts';
import { noAdjacentMultilineIf } from '../rules/layout/no-adjacent-multiline-if.ts';
import { noVoidArrayCallback } from '../rules/collections/no-void-array-callback.ts';
import { noTransposedAssignment } from '../rules/layout/no-transposed-assignment.ts';
import { noDetachedDocComments } from '../rules/comments/no-detached-doc-comments.ts';
import { noGratuitousExpressions } from '../rules/logic/no-gratuitous-expressions.ts';
import { noKeywordDeclarations } from '../rules/variables/no-keyword-declarations.ts';
import { noRedundantAssignment } from '../rules/variables/no-redundant-assignment.ts';
import { preferImmediateReturn } from '../rules/variables/prefer-immediate-return.ts';
import { noPositiveIndexCheck } from '../rules/collections/no-positive-index-check.ts';
import { noDuplicatedBranches } from '../rules/control-flow/no-duplicated-branches.ts';
import { noExcessCallArguments } from '../rules/functions/no-excess-call-arguments.ts';
import { noFloatingPointEquality } from '../rules/logic/no-floating-point-equality.ts';
import { preferPromiseShorthand } from '../rules/promises/prefer-promise-shorthand.ts';
import { noEqualLoopCondition } from '../rules/control-flow/no-equal-loop-condition.ts';
import { noUpdatedLoopCounter } from '../rules/control-flow/no-updated-loop-counter.ts';
import { noNestedTemplateLiterals } from '../rules/layout/no-nested-template-literals.ts';
import { noMisplacedLoopCounter } from '../rules/control-flow/no-misplaced-loop-counter.ts';
import { noUnenclosedMultilineBlock } from '../rules/layout/no-unenclosed-multiline-block.ts';
import { requireReduceInitialValue } from '../rules/collections/require-reduce-initial-value.ts';
import { noInconsistentFunctionCall } from '../rules/functions/no-inconsistent-function-call.ts';

/**
The rules about the language itself. Each key names the folder of `rules/` that holds its rules.
*/
export const LANGUAGE_TOPICS = {
    collections: [
        noElementOverwrite,
        noEmptyCollection,
        noInMisuse,
        noPositiveIndexCheck,
        noUnusedCollection,
        noVoidArrayCallback,
        requireReduceInitialValue,
    ],
    comments: [noCommentedCode, noCommentsInImports, noDetachedDocComments],
    'control-flow': [
        maxSwitchCases,
        noCompoundCase,
        noDuplicatedBranches,
        noEqualLoopCondition,
        noIgnoredCatch,
        noMisplacedLoopCounter,
        noNestedSwitch,
        noSmallSwitch,
        noSwitchCaseLabels,
        noUnthrownError,
        noUpdatedLoopCounter,
    ],
    functions: [
        noBooleanParameters,
        noEmptyReturnValue,
        noExcessCallArguments,
        noIdenticalFunctions,
        noIgnoredReturn,
        noInconsistentFunctionCall,
        noInvariantReturns,
        noMixedReturnTypes,
        noNestedFunctions,
        noSelectorParameter,
        noSwappedArguments,
        noTrivialFunctions,
        noUndefinedArgument,
    ],
    layout: [
        noAdjacentMultilineIf,
        noDetachedCall,
        noNestedTemplateLiterals,
        noTransposedAssignment,
        noUnenclosedMultilineBlock,
    ],
    logic: [
        noBitwiseInCondition,
        noFloatingPointEquality,
        noGratuitousExpressions,
        noIdenticalOperands,
        noNegatedComparison,
        noRedundantBoolean,
    ],
    promises: [noAsyncConstructor, noTryPromise, preferPromiseShorthand],
    regex: [
        maxRegexComplexity,
        noAmbiguousAnchors,
        noEmptyRepetition,
        noLazyBeforeOptional,
        noStatefulRegex,
        noStringRegexPattern,
        noUnknownRegexGroup,
    ],
    structure: [importBoundaries, noIndexImports, noRenamedExports, noRenamedImports, noTrivialFiles, restrictedSyntax],
    types: [
        noRedundantOptional,
        noUselessIntersection,
        preferReadonlyStatic,
        preferTypeAlias,
        preferTypeGuard,
        redundantTypeAliases,
    ],
    variables: [
        noDiscardedPostfix,
        noGlobalsShadowing,
        noKeywordDeclarations,
        noMagicNumbers,
        noRedundantAssignment,
        preferImmediateReturn,
    ],
};
