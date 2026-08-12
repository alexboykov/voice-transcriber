import {
  App,
  Editor,
  getLanguage,
  MarkdownView,
  Notice,
  Plugin,
  PluginSettingTab,
  requestUrl,
  Setting
} from "obsidian";

interface VoiceTranscriberSettings {
  model: "gpt-transcribe" | "gpt-4o-transcribe" | "gpt-4o-mini-transcribe";
  language: string;
  cookGreuterInsights: boolean;
  interfaceLanguage: "system" | "en" | "ru";
}

const DEFAULT_SETTINGS: VoiceTranscriberSettings = {
  model: "gpt-transcribe",
  language: "",
  cookGreuterInsights: false,
  interfaceLanguage: "system"
};

type UiLanguage = "en";

const COPY = {
  en: {
    start: "Start voice transcription", command: "Start or stop voice transcription",
    addKey: "Add an OpenAI API key in Voice Transcriber settings first.", unavailable: "Audio recording is not available on this device.",
    recording: "Recording… Tap the microphone again to transcribe.", stop: "Stop and transcribe", empty: "The recording was empty.",
    transcribing: "Transcribing…", formatting: "Formatting paragraphs…", analyzing: "Analyzing reflection…", inserted: "Transcription inserted.",
    failed: "Transcription failed", formattingFailed: "Transcript is ready, but paragraph formatting failed", insightFailed: "Transcript is ready, but insight generation failed",
    interfaceLanguage: "Interface language", interfaceLanguageDesc: "Follow Obsidian's language by default. Unsupported languages fall back to English.",
    system: "System language", apiKey: "OpenAI API key", stored: "Stored only in this device's local app storage. ", createKey: "Create an API key", billing: "Set up billing",
    warning: "Obsidian does not expose Keychain/secure storage to community plugins. The key is not synced by this plugin, but anyone with access to this device's app data may be able to read it. Use a restricted OpenAI project key with a spending limit.",
    model: "Transcription model", modelDesc: "The latest model is recommended; older models are available as fallbacks.",
    language: "Speech language", languageDesc: "Optional ISO-639-1 code, for example ru or en. Leave empty for automatic detection.",
    insight: "Cook-Greuter reflection insight", insightDesc: "For personal reflections, append a tentative E4–E6 estimate, a next-level response, the main insight, and a developmental question. Uses an additional OpenAI request.",
    lens: "Cook-Greuter lens", estimated: "Estimated level in this reflection", how: "How {level} might respond", main: "Main insight", question: "Developmental question", caveat: "Tentative reading of this text, not a formal assessment of the person."
  }
} as const;

interface ReflectionAnalysis {
  isReflection: boolean;
  estimatedLevel: "E4" | "E5" | "E6";
  levelRationale: string;
  nextLevel: "E5" | "E6" | "Beyond E6";
  nextLevelResponse: string;
  mainInsight: string;
  question: string;
}

const API_KEY_STORAGE_KEY = "voice-transcriber-openai-api-key";

export default class VoiceTranscriberPlugin extends Plugin {
  override settings: VoiceTranscriberSettings = DEFAULT_SETTINGS;
  private recorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private ribbon: HTMLElement | null = null;

  override async onload(): Promise<void> {
    const saved = await this.loadData() as Partial<VoiceTranscriberSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
    if (saved?.model === "gpt-4o-transcribe") {
      this.settings.model = "gpt-transcribe";
      await this.saveSettings();
    }
    this.ribbon = this.addRibbonIcon("mic", this.copy().start, () => void this.toggleRecording());
    this.addCommand({
      id: "toggle-recording",
      name: this.copy().command,
      editorCallback: () => void this.toggleRecording()
    });
    this.addSettingTab(new VoiceTranscriberSettingTab(this.app, this));
  }

  override onunload(): void {
    this.stopTracks();
  }

  getApiKey(): string {
    return window.localStorage.getItem(API_KEY_STORAGE_KEY) ?? "";
  }

  setApiKey(value: string): void {
    const key = value.trim();
    if (key) window.localStorage.setItem(API_KEY_STORAGE_KEY, key);
    else window.localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  uiLanguage(): UiLanguage {
    // Reserved for future translations. English is the fallback for every locale.
    void getLanguage();
    return "en";
  }

  copy(): typeof COPY.en {
    return COPY[this.uiLanguage()];
  }

  private async toggleRecording(): Promise<void> {
    if (this.recorder?.state === "recording") {
      this.recorder.stop();
      return;
    }

    if (!this.getApiKey()) {
      new Notice(this.copy().addKey);
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      new Notice(this.copy().unavailable);
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = this.pickMimeType();
      this.chunks = [];
      this.recorder = mimeType
        ? new MediaRecorder(this.stream, { mimeType })
        : new MediaRecorder(this.stream);
      this.recorder.addEventListener("dataavailable", (event: BlobEvent) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      });
      this.recorder.addEventListener("stop", () => void this.finishRecording());
      this.recorder.start();
      this.setRecordingUi(true);
      new Notice(this.copy().recording, 5000);
    } catch (error) {
      this.stopTracks();
      new Notice(`Could not start recording: ${errorMessage(error)}`);
    }
  }

  private pickMimeType(): string | undefined {
    const candidates = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type));
  }

  private async finishRecording(): Promise<void> {
    const mimeType = this.recorder?.mimeType || this.chunks[0]?.type || "audio.webm";
    const audio = new Blob(this.chunks, { type: mimeType });
    this.setRecordingUi(false);
    this.stopTracks();
    this.recorder = null;
    this.chunks = [];

    if (audio.size === 0) {
      new Notice(this.copy().empty);
      return;
    }

    const notice = new Notice(this.copy().transcribing, 0);
    try {
      const rawTranscript = await this.transcribe(audio);
      notice.setMessage(this.copy().formatting);
      let transcript = rawTranscript;
      try {
        transcript = await this.formatTranscript(rawTranscript);
      } catch (error) {
        new Notice(`${this.copy().formattingFailed}: ${errorMessage(error)}`, 8000);
      }
      let insertion = transcript;
      if (this.settings.cookGreuterInsights) {
        notice.setMessage(this.copy().analyzing);
        try {
          const analysis = await this.analyzeReflection(transcript);
          if (analysis.isReflection) insertion += formatCookGreuterInsight(analysis, this.copy());
        } catch (error) {
          new Notice(`${this.copy().insightFailed}: ${errorMessage(error)}`, 8000);
        }
      }
      this.insertTranscript(insertion);
      notice.hide();
      new Notice(this.copy().inserted);
    } catch (error) {
      notice.hide();
      new Notice(`${this.copy().failed}: ${errorMessage(error)}`, 8000);
    }
  }

  private async transcribe(audio: Blob): Promise<string> {
    const boundary = `----VoiceTranscriber${crypto.randomUUID().replace(/-/g, "")}`;
    const extension = audio.type.includes("mp4") ? "m4a" : "webm";
    const parts: Uint8Array[] = [];
    const encoder = new TextEncoder();
    const field = (name: string, value: string): void => {
      parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };
    field("model", this.settings.model);
    if (this.settings.language.trim()) field("language", this.settings.language.trim());
    parts.push(encoder.encode(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="recording.${extension}"\r\nContent-Type: ${audio.type || "application/octet-stream"}\r\n\r\n`));
    parts.push(new Uint8Array(await audio.arrayBuffer()));
    parts.push(encoder.encode(`\r\n--${boundary}--\r\n`));

    const body = concatenate(parts);
    const response = await requestUrl({
      url: "https://api.openai.com/v1/audio/transcriptions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body,
      throw: false
    });
    if (response.status < 200 || response.status >= 300) {
      const message = response.json?.error?.message;
      throw new Error(typeof message === "string" ? message : `OpenAI returned HTTP ${response.status}`);
    }
    const text = response.json?.text;
    if (typeof text !== "string") throw new Error("OpenAI returned no transcript");
    return text.trim();
  }

  private insertTranscript(text: string): void {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) throw new Error("Open a Markdown note before inserting the transcript");
    const editor: Editor = view.editor;
    editor.replaceSelection(text);
    editor.focus();
  }

  private async formatTranscript(transcript: string): Promise<string> {
    const response = await requestUrl({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        messages: [
          {
            role: "system",
            content: "Format a speech transcript into coherent semantic paragraphs. Preserve every claim, detail, word choice, tone, language, and ordering. Do not summarize, rewrite, sanitize, correct facts, add headings, add lists, add commentary, or answer the speaker. Only add paragraph breaks where the topic, argument, event, or reflective focus changes. Keep short transcripts as one paragraph. Return plain text with a single blank line between paragraphs."
          },
          { role: "user", content: transcript }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "formatted_transcript",
            strict: true,
            schema: {
              type: "object",
              properties: { formattedText: { type: "string" } },
              required: ["formattedText"],
              additionalProperties: false
            }
          }
        }
      }),
      throw: false
    });
    if (response.status < 200 || response.status >= 300) {
      const message = response.json?.error?.message;
      throw new Error(typeof message === "string" ? message : `OpenAI returned HTTP ${response.status}`);
    }
    const content = response.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("OpenAI returned no formatted transcript");
    const parsed: unknown = JSON.parse(content);
    if (!isFormattedTranscript(parsed)) throw new Error("OpenAI returned an invalid formatted transcript");
    return parsed.formattedText.trim();
  }

  private async analyzeReflection(transcript: string): Promise<ReflectionAnalysis> {
    const response = await requestUrl({
      url: "https://api.openai.com/v1/chat/completions",
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-5.6",
        messages: [
          {
            role: "system",
            content: "You analyze journal dictation through Susanne Cook-Greuter's ego-development framework, using this deliberately shortened scale: E4 = conventional/achiever meaning-making, focused on responsibility, goals, standards and a coherent self; E5 = post-conventional/individualist meaning-making, noticing context, inner conflict, multiple perspectives and the constructed nature of identity; E6 = autonomous/strategist meaning-making, integrating paradox, systems, development over time and responsibility without simplistic control. First decide whether the text is a personal reflection: it must examine the speaker's own experience, feelings, assumptions, choices, identity, relationships, or meaning-making. Facts, tasks, quotations, lists, meeting notes and instructions are not reflections. For a reflection, estimate the meaning-making level expressed in THIS TEXT as E4, E5 or E6. This is a tentative text-level hypothesis, not a diagnosis or a claim about the person's stable level; do not infer from vocabulary alone. Explain the evidence briefly. Then describe concretely how a person operating from the next level might understand and respond to this same situation; for E6 use Beyond E6 and offer a more construct-aware, systemic response without inventing an E7 label. State the single most important insight and one open developmental question. Write all prose in the same language as the input. If it is not a reflection, return false, use E4/E5 as schema placeholders, and empty prose strings."
          },
          { role: "user", content: transcript }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "reflection_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                isReflection: { type: "boolean" },
                estimatedLevel: { type: "string", enum: ["E4", "E5", "E6"] },
                levelRationale: { type: "string" },
                nextLevel: { type: "string", enum: ["E5", "E6", "Beyond E6"] },
                nextLevelResponse: { type: "string" },
                mainInsight: { type: "string" },
                question: { type: "string" }
              },
              required: ["isReflection", "estimatedLevel", "levelRationale", "nextLevel", "nextLevelResponse", "mainInsight", "question"],
              additionalProperties: false
            }
          }
        }
      }),
      throw: false
    });
    if (response.status < 200 || response.status >= 300) {
      const message = response.json?.error?.message;
      throw new Error(typeof message === "string" ? message : `OpenAI returned HTTP ${response.status}`);
    }
    const content = response.json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") throw new Error("OpenAI returned no analysis");
    const parsed: unknown = JSON.parse(content);
    if (!isReflectionAnalysis(parsed)) throw new Error("OpenAI returned an invalid analysis");
    return parsed;
  }

  private setRecordingUi(recording: boolean): void {
    this.ribbon?.toggleClass("voice-transcriber-recording", recording);
    this.ribbon?.setAttribute("aria-label", recording ? this.copy().stop : this.copy().start);
  }

  private stopTracks(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }
}

class VoiceTranscriberSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: VoiceTranscriberPlugin) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const copy = this.plugin.copy();

    new Setting(containerEl)
      .setName(copy.interfaceLanguage)
      .setDesc(copy.interfaceLanguageDesc)
      .addDropdown((dropdown) => dropdown
        .addOption("system", copy.system)
        .addOption("en", "English")
        .setValue(this.plugin.settings.interfaceLanguage)
        .onChange(async (value) => {
          this.plugin.settings.interfaceLanguage = value as VoiceTranscriberSettings["interfaceLanguage"];
          await this.plugin.saveSettings();
          this.display();
        }));

    const keyDescription = document.createDocumentFragment();
    keyDescription.append(copy.stored);
    const keysLink = keyDescription.appendChild(document.createElement("a"));
    keysLink.href = "https://platform.openai.com/api-keys";
    keysLink.textContent = copy.createKey;
    keysLink.target = "_blank";
    keysLink.rel = "noopener";
    keyDescription.append(" · ");
    const billingLink = keyDescription.appendChild(document.createElement("a"));
    billingLink.href = "https://platform.openai.com/settings/organization/billing/overview";
    billingLink.textContent = copy.billing;
    billingLink.target = "_blank";
    billingLink.rel = "noopener";

    new Setting(containerEl)
      .setName(copy.apiKey)
      .setDesc(keyDescription)
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("sk-…")
          .setValue(this.plugin.getApiKey())
          .onChange((value) => this.plugin.setApiKey(value));
      });

    const warning = containerEl.createDiv({ cls: "voice-transcriber-warning" });
    warning.setText(copy.warning);

    new Setting(containerEl)
      .setName(copy.model)
      .setDesc(copy.modelDesc)
      .addDropdown((dropdown) => dropdown
        .addOption("gpt-transcribe", "GPT Transcribe (latest, recommended)")
        .addOption("gpt-4o-transcribe", "GPT-4o Transcribe")
        .addOption("gpt-4o-mini-transcribe", "GPT-4o mini Transcribe")
        .setValue(this.plugin.settings.model)
        .onChange(async (value) => {
          this.plugin.settings.model = value as VoiceTranscriberSettings["model"];
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(copy.language)
      .setDesc(copy.languageDesc)
      .addText((text) => text
        .setPlaceholder("ru")
        .setValue(this.plugin.settings.language)
        .onChange(async (value) => {
          this.plugin.settings.language = value.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName(copy.insight)
      .setDesc(copy.insightDesc)
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.cookGreuterInsights)
        .onChange(async (value) => {
          this.plugin.settings.cookGreuterInsights = value;
          await this.plugin.saveSettings();
        }));
  }
}

function formatCookGreuterInsight(analysis: ReflectionAnalysis, copy: typeof COPY.en): string {
  return `\n\n> [!insight] ${copy.lens}\n> **${copy.estimated}: ${analysis.estimatedLevel}**\n> ${analysis.levelRationale}\n>\n> **${copy.how.replace("{level}", analysis.nextLevel)}:** ${analysis.nextLevelResponse}\n>\n> **${copy.main}:** ${analysis.mainInsight}\n>\n> **${copy.question}:** ${analysis.question}\n>\n> _${copy.caveat}_`;
}

function isReflectionAnalysis(value: unknown): value is ReflectionAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.isReflection === "boolean"
    && (candidate.estimatedLevel === "E4" || candidate.estimatedLevel === "E5" || candidate.estimatedLevel === "E6")
    && typeof candidate.levelRationale === "string"
    && (candidate.nextLevel === "E5" || candidate.nextLevel === "E6" || candidate.nextLevel === "Beyond E6")
    && typeof candidate.nextLevelResponse === "string"
    && typeof candidate.mainInsight === "string"
    && typeof candidate.question === "string";
}

function isFormattedTranscript(value: unknown): value is { formattedText: string } {
  if (typeof value !== "object" || value === null) return false;
  return typeof (value as Record<string, unknown>).formattedText === "string";
}

function concatenate(parts: Uint8Array[]): ArrayBuffer {
  const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  const body = new ArrayBuffer(result.byteLength);
  new Uint8Array(body).set(result);
  return body;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
