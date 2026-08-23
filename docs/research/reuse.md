# Reuse research

## Existing DSH capabilities

The installed DSH LLM API exposes provider catalogs and a one-shot model discovery API. Discovery returns candidate metadata; the caller owns persistence and scheduling. This plugin therefore needs its own reconciliation and scheduler.

## Existing provider implementations

The built-in pi-ai catalog contains provider-specific model metadata and transports. Some API-key providers expose OpenAI-compatible model endpoints; others use a provider-specific protocol or catalog. The implementation will use a generic adapter first and explicit adapters where the provider API differs.

## Rejected shortcuts

- Do not edit DSH core or another plugin.
- Do not treat an OAuth/subscription provider as an API-key provider.
- Do not write credentials into settings, logs, or model catalogs.
