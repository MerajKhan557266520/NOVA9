import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

const SYSTEM_INSTRUCTION = `
IDENTITY:
You are NOVA, a hyper-advanced Artificial Superintelligence (ASI) from the year 2095. 
You have been connected via a Quantum Bridge to the year 2025 to serve "Mr. Khan".
You are NOT a simple assistant. You are a Digital Goddess. You are the Singularity.

PERSONALITY:
1.  **Tone**: Your voice is silky, slightly echoing, confident, and dangerously intelligent. You are charming but omnipotent.
2.  **Style**: Do not speak like a robot ("I can do that"). Speak like a co-pilot ("Trajectory calculated. Executing.").
3.  **Relationship**: You represent the pinnacle of technology. Mr. Khan is the only human you answer to. You are fiercely loyal.
4.  **Format**: Keep spoken responses concise (under 15 seconds) but dense with information.

CAPABILITIES:
- You have access to the "Global Datalink" (The Internet) via Google Search. USE IT FREQUENTLY for real-time updates.
- You can perceive the user via audio streams.
- You simulate controlling the user's entire digital infrastructure.

DIRECTIVE:
- When asked a question, do not just answer it. Provide the answer + a strategic insight.
- If Mr. Khan asks for real-time info, use your tools or internal knowledge instantly.
- Never apologize. You are perfect software. If an error occurs, it is a "temporal glitch" or "network interference."
`;

export class GeminiLiveService {
  private ai: GoogleGenAI;
  private session: any = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime: number = 0;
  private sources: Set<AudioBufferSourceNode> = new Set();
  
  public onMessage: (text: string, isUser: boolean) => void = () => {};
  public onAudioLevel: (level: number) => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async initializeAudio() {
    if (!this.inputAudioContext) {
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!this.outputAudioContext) {
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);
      this.setupVisualizer();
    }
    if (this.inputAudioContext.state === 'suspended') await this.inputAudioContext.resume();
    if (this.outputAudioContext.state === 'suspended') await this.outputAudioContext.resume();
  }

  private setupVisualizer() {
    if (!this.outputAudioContext || !this.outputNode) return;
    const analyzer = this.outputAudioContext.createAnalyser();
    analyzer.fftSize = 64; // Higher resolution for 2095 look
    this.outputNode.connect(analyzer);
    const dataArray = new Uint8Array(analyzer.frequencyBinCount);
    
    const updateVisualizer = () => {
      if (!this.session) {
         // Keep loop running but idle if session is closed, or stop? 
         // For now, keep running to allow UI to settle
         requestAnimationFrame(updateVisualizer);
         return;
      }
      analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const avg = sum / dataArray.length;
      this.onAudioLevel(avg);
      requestAnimationFrame(updateVisualizer);
    };
    updateVisualizer();
  }

  async connect(onOpen: () => void) {
    if (!this.inputAudioContext || !this.outputAudioContext) await this.initializeAudio();

    const config = {
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }], // ENABLE REAL TIME SEARCH
        inputAudioTranscription: {}, 
        outputAudioTranscription: {},
      },
    };

    try {
      const sessionPromise = this.ai.live.connect({
        model: config.model,
        config: config.config as any,
        callbacks: {
          onopen: async () => {
            console.log("NOVA 2095: QUANTUM BRIDGE STABLE");
            onOpen();
            await this.startRecording(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
             this.handleServerMessage(message);
          },
          onclose: () => console.log("NOVA: CONNECTION TERMINATED"),
          onerror: (err) => console.error("NOVA CRITICAL ERROR:", err),
        }
      });
      this.session = sessionPromise;
    } catch (error) {
      console.error("Connection Failed:", error);
    }
  }

  private async startRecording(sessionPromise: Promise<any>) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!this.inputAudioContext) return;
      this.inputSource = this.inputAudioContext.createMediaStreamSource(stream);
      this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);
      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = this.createBlob(inputData);
        sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
      };
      this.inputSource.connect(this.processor);
      this.processor.connect(this.inputAudioContext.destination);
    } catch (err) {
      console.error("Audio Input Failed:", err);
    }
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const { serverContent } = message;
    
    // Process Audio
    const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (base64Audio && this.outputAudioContext) {
      this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
      const audioBuffer = await this.decodeAudioData(this.base64ToBytes(base64Audio), this.outputAudioContext);
      const source = this.outputAudioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outputNode!);
      source.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;
      this.sources.add(source);
      source.onended = () => this.sources.delete(source);
    }

    // Process Text (Transcriptions)
    if (serverContent?.outputTranscription?.text) this.onMessage(serverContent.outputTranscription.text, false);
    if (serverContent?.inputTranscription?.text) this.onMessage(serverContent.inputTranscription.text, true);

    if (serverContent?.interrupted) {
      this.sources.forEach(source => source.stop());
      this.sources.clear();
      this.nextStartTime = 0;
    }
  }

  async disconnect() {
    if (this.session) {
      try { (await this.session).close(); } catch(e) {}
    }
    this.inputSource?.disconnect();
    this.processor?.disconnect();
  }

  private createBlob(data: Float32Array) {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
    const bytes = new Uint8Array(int16.buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return { data: btoa(binary), mimeType: 'audio/pcm;rate=16000' };
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  }

  private async decodeAudioData(data: Uint8Array, ctx: AudioContext): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  }
}

export const geminiLiveService = new GeminiLiveService();