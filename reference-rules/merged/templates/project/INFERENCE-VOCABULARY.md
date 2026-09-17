---
layer: template
preset: none
title: Inference Project Vocabulary
---

# Inference Project Vocabulary

Project template. Copy into `rules/project/` when the repository serves or trains models with
named engines, quantization modes, and published artifacts. Edit the names to match the project.

## Data, models, and external boundaries

Model names, engine names, quantization modes, runtime scenarios, and Hugging
Face names are repository contracts. Rename them deliberately.

Rules:

- Model and engine keys use lowercase words separated by underscores when they
  are internal keys, such as `trt_int4` or `vllm_awq`.
- Provider repository IDs and external model names preserve provider spelling.
- Runtime, warmup, and test scenario names describe the behavior being tested.
- Conversation and prompt names describe the scenario, not the file or helper
  that created them.
- Engine labels, quantization labels, and runtime mode names use stable serving
  language such as `trt`, `vllm`, `awq`, `fp8`, and `warmup`.
- Metrics and latency fields use stable operational names such as `p50`, `p90`,
  `p95`, `ttfb`, `total_latency`, `prediction`, and `expected`.
- Do not put raw user text, tokens, local absolute paths, or private identifiers
  into artifact names intended for publishing.
- If a name is part of an external contract, treat renaming it as a contract
  change.

Bad:

```python
engine_key = "myNewThing"
conversation_name = "test_1"
result_field = "thing"
```

Good:

```python
engine_key = "vllm_awq"
conversation_name = "multi_turn_warmup"
result_field = "prediction"
```

## Import contracts

The import-linter contracts the reference inference repository enforces; keep the ones that
match the project's packages:

- `config` must not import `state`.
- `config` must not import runtime orchestration packages.
- `state` must not import model publishing modules.
- Session handlers must not import the websocket or runtime orchestration stack.
- Runtime bootstrap code must not import the websocket stack.
- Engines must not import handlers.
- Scripts must not import engines directly.
