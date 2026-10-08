---
title: Zod
---

# Zod

Check the installed release and its consumers before choosing an API. Put a runtime schema with
the feature that owns the contract. Infer input and output types from it rather than keeping a
second handwritten contract.

## Validate boundaries

Parse values at the boundary that receives them and pass the parsed result inward. Static types,
a constructed validator, and successful client validation do not validate a server request.
An invalid provider response is an integration failure, not invalid user input. A valid identifier
proves no access.

Choose thrown or returned validation issues to match the boundary. Async checks need async parsing;
a safe parse does not catch exceptions thrown by custom code or transport decoding. Keep resource
limits on collections and nesting. Preserve original bytes when signatures depend on them.

See [parsing and inferred types](https://zod.dev/basics).

## Patches and normalization

Derive a patch from fields the caller may edit, not the whole persistence row. Keep omission,
undefined, null, and empty input distinct. Defaults do not silently turn absence into a write.
Normalize only where the contract permits it; never trim signed values, passwords, or exact-byte
identifiers. Coercion must not turn an empty required number into zero.

Response fields are projected before return. A loose object schema is not a privacy boundary.
Request-specific state is passed to validation, not captured in a process-wide schema.

See [schema APIs](https://zod.dev/api).

## Errors and published contracts

Return safe field paths and stable codes. Keep private values out of issues and error messages;
do not enable raw input reporting for private payloads. Translate at the request or presentation
boundary without mutating global locale state for one request.

A JSON Schema projection cannot represent every runtime contract. Keep runtime validation and
verify the exported dialect against meaningful examples. Use an explicit transport schema for
non-JSON values instead of allowing every value in the projection. Regenerate consumers when the
contract changes, and check omitted fields, defaults, patches, and date handling after an upgrade.

See [error customization](https://zod.dev/error-customization)
and [JSON Schema](https://zod.dev/json-schema).
