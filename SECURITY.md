# Security policy

## Reporting a vulnerability

Please do not publish exploitable security issues in a public issue. Contact **info@boykov.im** with a description, reproduction steps, affected version, and any suggested mitigation.

## Data flow

Voice Transcriber sends microphone audio directly to `api.openai.com` for transcription. If Cook-Greuter insights are enabled, it sends the resulting transcript directly to the same host for analysis. It has no developer-operated backend, analytics, telemetry, advertising, or additional network destinations.

The OpenAI API key is stored in device-local WebView storage because Obsidian does not expose a cross-platform secure keychain API to community plugins. Users should create a dedicated restricted project key and configure spending limits.
