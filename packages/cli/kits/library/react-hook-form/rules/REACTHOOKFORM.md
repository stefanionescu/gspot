---
title: React Hook Form
---

# React Hook Form

Form ownership, values, registration, validation, subscriptions, field arrays, submission,
server actions, errors, composition, and paths. The React and TypeScript rules apply
underneath. The React hooks rules report a conditional hook and a missing Effect dependency,
and `tsc` reports a widened `FieldValues` or a cast path. This file holds the decisions no
rule can see.

Verify every API against the installed React Hook Form, React, resolver, and component
versions. v7 and the v8 beta are separate contracts. `createFormControl` arrives in 7.55,
`useForm.validate` in 7.72, field-array `disabled` in 7.79, and `fields[].disabled` in 7.80.
`exact` subscription semantics change in 7.81, and `keyName` leaves in the next major.
`@hookform/resolvers` stays compatible with the installed Zod, through the official
`zodResolver` rather than a rebuilt error mapping. See
[useForm](https://react-hook-form.com/docs/useform) and
[resolvers](https://github.com/react-hook-form/resolvers).

## Form ownership and values

Each independently editable form has one `useForm` instance inside a Client Component
boundary. Server Components load authorized initial data and pass a serializable input model
down. No `createFormControl` instance is a module singleton on the server. Server rendering
and the first client render share the same defaults, never derived from browser storage, a
random value, or a browser clock. The query cache owns server snapshots and the form owns the
editable draft, so keystrokes are not mirrored into a store, query data, and local state.

Navigating to another record either resets the form or creates a new instance by an explicit
decision, because a preserved Client Component keeps cached defaults. An ordinary validation
error is cleared through the error or reset API rather than a recreated form.

`defaultValues` are complete for the input model and set the baseline for `isDirty` and
`dirtyFields`; new props do not replace the cached baseline. Controlled fields get
field-appropriate empty values (an empty string, an empty array, an allowed `null`), never
`undefined`. Async `defaultValues` serve initial loading when that matches the data owner,
with `formState.isLoading`, failure, and retry surfaced. The same snapshot is not fetched
again through TanStack Query. `values` reactively overwrites edits and defaults, so
`resetOptions` are chosen before connecting it to a query that refetches in the background.

`reset(nextValues)` accepts a new baseline after a confirmed save or a deliberate record
change, once subscriptions have initialized. `keepDirtyValues` keeps edits while untouched
fields refresh, `keepDirty` keeps only the flags, and `keepDefaultValues` keeps the comparison
baseline. No broad preservation option carries dirty values from one record into another.
`resetField` resets one registered field with a valid default.

The `errors` object passed to
`useForm` is reference-stable. An Effect depends on the specific method it calls, such as
`reset`, and a reset is triggered by a data or identity change rather than every form-state
update. See [reset](https://react-hook-form.com/docs/useform/reset).

## Registration and validation

`register` serves native inputs and components that forward the native contract, keeping its
`name`, `ref`, `onChange`, and `onBlur`. `Controller` or `useController` adapts an external
controlled component, registered once and never combined with `register(name)` on the same
input. Every logical field has a stable typed path, and unrelated inputs never share one.
`field.value`, `onChange`, `onBlur`, `name`, `disabled`, and the ref map to their component
props, with the ref on the focusable input through the library's `inputRef` where needed. An
override spreads `field` first so `onBlur` and `ref` survive.

Changes flow through `field.onChange` alone. `setValue` is an intentional programmatic update
with `shouldDirty`, `shouldTouch`, and `shouldValidate` chosen per operation, and it never
sends `undefined`. A disabled `Controller` omits its value from submission, so a value that
must stay in the payload uses a read-only control, and trusted identifiers are derived again
on the server. A `FileList` is not a text default; empty selection, replacement, reset, and
upload state are decided explicitly. See
[Controller](https://react-hook-form.com/docs/usecontroller/controller).

One validation authority owns the form. With `zodResolver`, validation lives in the schema.
`register` validators and `useForm.validate` do not run as a second layer, and native HTML
constraints agree with it. Input and output types are inferred separately when transforms
change them. Defaults, paths, and controls use the input model, and the valid submit callback
receives the parsed output, with resolver `raw` mode explicit if input is returned. Async
refinements use async resolution.

Empty numbers, checkboxes, dates, and repeated values are normalized once at the owning
boundary, because `valueAsNumber` yields `NaN` and `parseInt` accepts a trailing suffix. A
missing number never silently becomes zero. A numeric control supports an empty input, a lone
minus sign, and a complete integer as distinct editing states. `mode` and `reValidateMode`
set feedback timing without whole-form or network validation per keystroke.
`criteriaMode: 'all'` exists only when the UI shows every issue, and a custom resolver
returns hierarchical `errors` beside `values`. Browser schemas carry no server-only
dependencies, and the server validates and authorizes again.

```tsx
const quantitySchema = z.object({
    quantity: z.string().regex(/^\d+$/).transform(Number).pipe(z.int().min(1)),
});

function useQuantityForm() {
    return useForm<z.input<typeof quantitySchema>, unknown, z.output<typeof quantitySchema>>({
        resolver: zodResolver(quantitySchema),
        defaultValues: { quantity: '' },
    });
}
```

The server receives the parsed number, validates that transport contract explicitly, and does
not run the string transform a second time.

## Subscriptions

`useWatch` sits beside the component that shows a changing value and `useFormState` beside
the one that shows field or submission state; a root-level `watch()` rerenders the whole
form. `formState` properties are read during rendering, unconditionally, so the Proxy
subscribes. `getValues` is an imperative snapshot, also used when a component mounts after an
update it must see. Field names and `exact` are chosen deliberately, and `compute` derives a
display value without writing back during rendering.

`subscribe` serves reads outside rendering. Its unsubscribe is returned from the owning
Effect, and no `setValue` or `reset` feeds back into the same subscription. A child waits for
`formState.isReady` before an initialization update that needs the parent's subscriptions,
distinct from async default loading. `dirtyFields` describes individual changes and
`isDirty` the whole form, with an explicit decision on whether a value restored to its
default counts as unsaved. See [useWatch](https://react-hook-form.com/docs/usewatch) and
[formState](https://react-hook-form.com/docs/useform/formstate).

## Field arrays and unmounting

`useFieldArray` owns editable object rows such as `{ items: [{ label: '', quantity: '' }] }`,
never primitive arrays, with one hook owner and a stable `name` per array. Each row's React
key is the generated `field.id`, and its registered path uses the current index. Database IDs
live in a separate property such as `recordId`. Existing data with an `id` property either
accounts for the generated key or uses `keyName` deliberately. `fields` is row structure, not
a live value subscription; current values come from `useWatch`, `getValues`, or submission,
and a merge with row metadata keeps the generated key.

`append`, `prepend`, `insert`, and `update` receive complete rows from a row factory.
`update` remounts the row, so a leaf `setValue` preserves focus and widget state, and
`replace` is a deliberate whole-array swap. `move` and `swap` reorder, `remove(index)` deletes
one row, and `remove()` with no index removes every row, stated at the call site. Dependent
mutations are not stacked in one event, and no unconditional mount Effect deletes a row.
`shouldUnregister: true` is avoided on forms that own arrays.

Built-in array `rules` report at `errors.<arrayName>.root` only on the built-in path; with a
resolver, errors render from the nested schema result. Field-array `disabled` disables the
whole array and its methods, mirrored through `field.disabled` that is forwarded explicitly.
Additions choose `shouldFocus`, `focusName`, or `focusIndex` by interaction, and a background
update never steals focus. See
[useFieldArray](https://react-hook-form.com/docs/usefieldarray).

The default `shouldUnregister: false` retains hidden values. With unregistering enabled,
unmounting removes them, and the schema follows the chosen branch because unregistering does
not rewrite a resolver that still requires the field. Conditional fields distinguish
hidden-but-retained data from data to discard. Hooks stay unconditional, and a branch is
extracted into its own component. Wizard steps keep one provider above the steps or save
drafts in an explicitly scoped owner. Each step is validated before advancing, the whole
payload at the end, and no draft persists credentials or uses a server singleton.

Virtualized forms keep the owner mounted while rows scroll, retain values across row
unmounts, and integrate with the existing virtualizer. An offscreen invalid input is focused
only after resolving its row, scrolling it into view, and waiting for its ref. `fields` and
defaults are never copied over current edits on remount.

## Submission, server actions, and errors

`handleSubmit` validates and calls the valid handler, which awaits the real save so
`isSubmitting` reflects it. With TanStack Query that is `mutateAsync`, because `mutate`
returns at once. `handleSubmit` does not swallow a thrown rejection, so the DOM event handler
handles it under the promise policy. Expected validation, conflict, and permission failures
are safe structured results that preserve values and keep retry available. Duplicate
submissions are prevented by the save operation's state, with server idempotency where
retries can duplicate a write.

`isSubmitSuccessful` is not proof of a domain write, because a callback that catches and
returns normally succeeds from the form's view. Reset or navigation follows an explicit
server result. Returned canonical values are first reconciled into the input representation,
and query data is updated through its owner. Pending, validation, and result state stay
distinct without a second loading flag.

A Server Action is called awaited from the valid submit handler, or through `useActionState`
when its result and pending state are useful. Only values the transport allows are sent, and
the server validates and authorizes again. A manually called dispatcher runs inside
`startTransition`. The Action's `isPending` covers the work, because dispatch returns no
promise:

```tsx
const [result, dispatchSave, isPending] = useActionState(saveProfile, initialResult);

const submitValidated = handleSubmit((values) => {
    startTransition(() => {
        dispatchSave(values);
    });
});
```

The Action's result and pending flag are not mirrored into local state. An Effect may map
returned field errors into `setError` after validating the paths against the form contract.
The method sits in its dependencies, and a guard rejects a stale response for another record.
A JavaScript-only `onSubmit` bridge does not submit before hydration, so progressive
enhancement uses a native form Action or the library's `Form` integration, verified without
JavaScript. `progressive` and `shouldUseNativeValidation` establish no transport or server
validation. See [useActionState](https://react.dev/reference/react/useActionState).

Every input has a visible label. Its instructions and current error are linked through
stable IDs and `aria-describedby`. `aria-invalid` comes from its validation state, and new
errors or a summary are announced once through an alert or live region. Controlled fields
read `fieldState.error` and native fields the nested error path, and parent and array errors
stay visible beside leaf errors. `setError` carries returned field failures and a
`root.server` key for a safe operation error, cleared when the cause is gone.

`clearErrors` is not revalidation; `trigger` is, awaited before a validity-dependent action.
`isValid` is validation state rather than authorization or a saved write. Refs stay attached
for `shouldFocusError` and `setFocus`, and focus waits for the control to mount after a
reset. Safe error codes pass through the internationalization layer; raw exceptions, SQL,
submitted secrets, and resolver dumps never render. Native validation is used only with
compatible modes, real input refs, string messages, and verified browser behavior for the
custom controls in use.

## Composition and paths

`FormProvider` and `useFormContext` serve deeply nested descendants from one provider at the
form's ownership boundary. One form has no nested providers, HTML forms do not nest, and
typed field props or context beat cloning children by a `name` prop.
Subscriptions live in the smallest field or status component, and `useController` gives a
reusable controlled field its own state. DevTools overhead is checked before diagnosing
provider performance, and memoization follows measurement.

`createFormControl` exists only for an explicit control owner or a read outside React. It
stays stable and scoped to its form and connects through `useForm({ formControl })`, with its
`control` passed to hooks rather than a redundant provider. External subscriptions are
released on disposal, so one user's values never reach another editor. See
[createFormControl](https://react-hook-form.com/docs/createFormControl).

Reusable adapters use `FieldPath`, `FieldArrayPath`, `Control`, and related types inferred
from the concrete input model. No form widens to `FieldValues`, and no server string is cast
into a field name. Indexed paths keep literal types through `as const` where inference needs
it, and nested arrays are modeled with their object shape and the current index. A recursive
Zod schema is projected into a finite editing model, because the path helpers do not support
cycles.

`OpaqueTypes` registration through module augmentation covers a rich leaf value only, in an
included module file that preserves the original declarations. It changes traversal without
validating, serializing, or fixing default comparison, so a plain editing representation is
preferred. Form tests cover the changed interaction with the existing runner and accessible
queries. They await validation and submission instead of sleeping and add no frameworks,
wrappers, or broad browser checks. See
[form testing](https://react-hook-form.com/advanced-usage#TestingForm).
