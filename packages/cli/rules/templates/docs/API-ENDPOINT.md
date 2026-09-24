---
layer: template
configuration: none
title: API Endpoint Template
---

# API Endpoint Template

Template. Remove sections that do not apply. Do not publish empty headings or placeholder
prose.

````markdown
## `METHOD /path`

State what the operation does.

Permissions: REQUIRED_ACCESS.

### Request

Headers:

| Header | Required | Description |
|--------|:--------:|-------------|
| `Authorization` | Yes | Bearer token with REQUIRED_SCOPE. |

Path parameters:

| Parameter | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `id` | `string` | Yes | RESOURCE_IDENTIFIER. |

Request body:

```json
{
  "field": "value"
}
```

### Response

Success status: `200 OK`.

```json
{
  "status": "ok"
}
```

### Errors

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_REQUEST` | The request does not match the schema. |

### Example

```shell
curl --request METHOD \
  --url https://api.example.com/path \
  --header "Authorization: Bearer <ACCESS_TOKEN>"
```
````
