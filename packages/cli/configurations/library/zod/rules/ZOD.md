# Zod

Read this rule when you write or change a Zod schema.

Check the installed release and its consumers before choosing an API. Put a runtime schema with the feature that owns
the contract. Infer types from the schema, or check a handwritten type against it with `satisfies z.ZodType<T>`. Never
keep a second contract that the compiler does not compare.

## Validate boundaries

Parse values at the boundary that receives them and pass the parsed result inward. Static types, a constructed
validator, and successful client validation do not validate a server request. An invalid provider response shows an
integration failure, not bad user input. A valid identifier proves no access.

Choose thrown or returned validation issues to match the boundary. Async checks need async parsing; a safe parse does
not catch exceptions thrown by custom code or transport decoding. Keep resource limits on collections and nesting.
Preserve original bytes when signatures depend on them.

See [parsing and inferred types](https://zod.dev/basics).

## Patches and normalization

Derive a patch from fields the caller may edit, not the whole persistence row. Keep omission, undefined, null, and empty
input distinct. Defaults do not silently turn absence into a write. Normalize only where the contract permits it; never
trim signed values, passwords, or exact-byte identifiers. Do not let coercion turn an empty required number into zero.
`z.coerce.boolean()` runs `Boolean(input)`, so the string `"false"` becomes `true`; parse flag strings with
`z.stringbool()`.

Select response fields before returning them. A loose object schema does not protect private data. Pass request-specific
state to validation. Do not capture it in a process-wide schema.

See [schema APIs](https://zod.dev/api).

## Errors and published contracts

Return safe field paths and stable codes. Keep private values out of issues and error messages; do not enable raw input
reporting for private payloads. Translate at the request or presentation boundary without mutating global locale state
for one request.

A JSON Schema projection cannot represent every runtime contract. Keep runtime validation and verify the exported
dialect against meaningful examples. Use an explicit transport schema for non-JSON values instead of allowing anything
in the projection. Regenerate consumers when the contract changes, and check omitted fields, defaults, patches, and date
handling after an upgrade.

See [error customization](https://zod.dev/error-customization) and [JSON Schema](https://zod.dev/json-schema).
