# Voice Transcriber

Voice Transcriber records speech from Obsidian on desktop or mobile, sends the completed recording directly to OpenAI's transcription API, and inserts the returned text at the cursor in the active Markdown note.

## Why Voice Transcriber?

Capture thoughts without leaving Obsidian. Record from the ribbon on desktop or mobile, then let OpenAI produce a high-quality transcript directly in your note. Optionally, reflective entries can receive a structured developmental reading inspired by Susanne Cook-Greuter's ego-development framework.

## Current features

- One microphone ribbon button to start and stop recording.
- The same action is available from the command palette.
- Uses the latest high-accuracy `gpt-transcribe` by default, with older transcription models available as fallbacks.
- Automatically splits transcripts into coherent semantic paragraphs without summarizing or rewriting them.
- Optional language hint.
- Optional Cook-Greuter E4–E6 estimate, next-level response, main insight, and developmental question for personal reflections; disabled by default.
- The plugin follows Obsidian's language setting and currently falls back to English for every locale.
- No analytics, telemetry, advertising, accounts, proxy server, or third-party SDKs.

This first version transcribes after recording stops. Streaming transcription can be considered later, but adds substantially more connection and lifecycle complexity on iOS.

## Installation for development

1. Run `npm install` and `npm run build`.
2. Copy `manifest.json`, `main.js`, and `styles.css` into `<vault>/.obsidian/plugins/voice-transcriber/`.
3. Enable **Voice Transcriber** under Community plugins.
4. Add an OpenAI API key in the plugin settings on each device.

## Usage

1. Open **Settings → Voice Transcriber**.
2. Create an OpenAI API key using the link beside the key field and set up API billing.
3. Paste the key and optionally enable **Cook-Greuter reflection insight**.
4. Open a Markdown note and tap the microphone icon.
5. Speak, then tap the icon again. The transcript is inserted at the cursor when processing finishes.

The interface follows Obsidian's language setting and currently uses English as the universal fallback. The separate **Speech language** field is optional; leave it empty for automatic language detection.

## Cook-Greuter insight

When enabled, a second OpenAI request checks whether the transcript is a personal reflection. For reflections only, it appends an Obsidian callout containing:

- a tentative E4, E5, or E6 estimate for the meaning-making expressed in that text;
- brief supporting evidence;
- how the next developmental perspective might respond;
- the main insight and a developmental question.

This is an informal interpretation of one text, not a validated SCT/MAP assessment, clinical advice, or a stable judgment of a person.

## Privacy and security disclosure

- Microphone audio is kept in memory while recording and is not written to the vault or filesystem by this plugin.
- When recording stops, the audio is sent directly to `https://api.openai.com/v1/audio/transcriptions`. If Cook-Greuter insights are enabled, the transcript is also sent directly to OpenAI for reflection classification and analysis. OpenAI processes that content under the user's own API account and applicable OpenAI policies.
- The resulting transcript is inserted only into the active note.
- The API key is stored in the app WebView's device-local storage, not in the plugin's `data.json`, source code, repository, or a developer-controlled server. The plugin does not sync the key.
- Obsidian does not provide community plugins with a cross-platform secure keychain API. Consequently, this storage is not equivalent to iOS Keychain or macOS Keychain. Someone who can access the device's Obsidian app data may be able to recover it. Use a dedicated restricted OpenAI project key and configure budget/usage limits.
- No telemetry or other network requests are made.

## Permissions

The plugin requests microphone permission when recording starts and requires network access to `api.openai.com`. An OpenAI API account with available credit is required.

## Support

Use the repository's GitHub Issues page for bug reports and feature requests. For security reports, see [SECURITY.md](./SECURITY.md).

## Publishing checklist

Before submission to the Obsidian community plugin directory:

- Replace the placeholder `author` in `manifest.json` and add the repository URL/funding metadata if desired.
- Pick and verify the final plugin name and ID.
- Test microphone permission, recording, cancellation, backgrounding, and insertion on iOS, Android, macOS, and Windows.
- Add release automation and attach `manifest.json`, `main.js`, and `styles.css` to a GitHub release whose tag matches the manifest version.
- Re-run Obsidian's plugin review/self-critique checklist.
