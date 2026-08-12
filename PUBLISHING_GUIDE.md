# Publishing Voice Transcriber

Repository: <https://github.com/alexboykov/voice-transcriber>

## 1. Verify the publisher details

The public author is Alexander Boykov, the GitHub account is `alexboykov`, and security reports go to `info@boykov.im`. Add `fundingUrl` to `manifest.json` only if you want it shown publicly.

Decide before release whether the public name **Voice Transcriber** and ID `voice-transcriber` are final. The ID must be globally unique, cannot contain `obsidian`, and should not change after publication.

## 2. Create the public GitHub repository

The public repository is `alexboykov/voice-transcriber`. From this project folder run:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin git@github.com:alexboykov/voice-transcriber.git
git push -u origin main
```

Do not commit `data.json`; it is ignored because it may contain user settings. Verify that no key or personal vault content is present:

```bash
git status
git grep -n "sk-"
```

## 3. Test the release candidate

Run:

```bash
npm install
npm run build
npm audit --omit=dev
```

Test at minimum:

- desktop recording, stopping, and insertion at the cursor;
- iOS and Android microphone permission and recording;
- English and unsupported-system-language fallback;
- invalid/expired API key behavior;
- automatic speech-language detection;
- insight disabled, non-reflection, reflection, and insight API failure;
- app backgrounding during recording and processing;
- a long recording within OpenAI's documented upload limits.

## 4. Create GitHub release 1.0.0

The release tag must be exactly `1.0.0`, matching `manifest.json`—do not prefix it with `v`.

On GitHub open **Releases → Draft a new release**, create tag `1.0.0`, use title `Voice Transcriber 1.0.0`, paste the release notes below, and attach these three individual files from the project root:

- `main.js`
- `manifest.json`
- `styles.css`

Do not upload only the ZIP; Obsidian downloads the individual assets by exact filename.

### Release notes

```markdown
## Voice Transcriber 1.0.0

First public release.

- Record speech from Obsidian desktop and mobile.
- Transcribe with OpenAI GPT Transcribe and insert at the cursor.
- Automatically detect spoken language or provide a language hint.
- Optional Cook-Greuter reflection analysis with a tentative E4–E6 estimate, next-level perspective, main insight, and developmental question.
- English UI with system-language detection and English fallback.
- No telemetry, advertising, developer backend, or third-party analytics.
```

Publish the release and verify all three assets can be downloaded while logged out of GitHub.

## 5. Submit to the Obsidian Community directory

1. Sign in at <https://community.obsidian.md> with your Obsidian account.
2. Link your GitHub account in your profile.
3. Choose the option to add/claim a plugin or theme.
4. Enter the public repository URL.
5. Confirm the directory reads `manifest.json` version `1.0.0` from the default branch.
6. Submit and follow the automated review results.

The initial submission is the only directory submission. Future versions are delivered from your GitHub releases.

## 6. Address review feedback

Never replace the files of an already published release after changing code. For each correction:

1. Increase the version in `manifest.json` and `package.json`, for example to `1.0.1`.
2. Add `"1.0.1": "1.5.0"` to `versions.json`.
3. Rebuild and commit the source changes.
4. Create tag/release `1.0.1` with fresh `main.js`, `manifest.json`, and `styles.css` attachments.
5. Return to the directory review page and re-run or publish the review as instructed.

## 7. Suggested directory copy

**Name:** Voice Transcriber

**Short description:** Record speech, transcribe it with OpenAI, and insert the text directly into your notes on desktop and mobile.

**Long description:** Voice Transcriber captures microphone audio inside Obsidian and sends it directly to the user's OpenAI API account for high-quality transcription. The transcript is inserted at the cursor without leaving the note. An optional Cook-Greuter mode recognizes personal reflections and appends a tentative E4–E6 developmental reading, a next-level perspective, the main insight, and a reflective question. Uses English as the fallback for every system language and contains no telemetry or developer-operated backend.

**Privacy summary:** Audio and optional reflection text are sent only to OpenAI under the user's own API account. The plugin has no analytics, telemetry, ads, or developer server. The API key stays in device-local app storage but is not protected by a system keychain.

## 8. After approval

- Announce the plugin in Obsidian's **Share & showcase** forum category.
- Request the Obsidian Discord developer role and post releases in `#updates`.
- Enable GitHub Issues and watch security contact messages.
- Maintain semantic versions and release assets for every update.

## Final gate

Do not submit until every item is true:

- [ ] Public author and security-contact placeholders are replaced.
- [ ] Name and ID are final.
- [ ] Repository is public and source code is present.
- [ ] `README.md`, `LICENSE`, `SECURITY.md`, `manifest.json`, and `versions.json` are committed.
- [ ] Version is `1.0.0` everywhere.
- [ ] Build and audit pass.
- [ ] Mobile and desktop smoke tests pass.
- [ ] Release tag is exactly `1.0.0`.
- [ ] Release contains individual `main.js`, `manifest.json`, and `styles.css` assets.
- [ ] Privacy/network/API-account requirements are disclosed.
- [ ] No API key, vault content, personal path, or private identity appears in the repository or release.
