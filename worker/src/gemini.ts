import { GoogleGenAI, Type, Schema } from "@google/genai";

/**
 * Server-side Gemma 4 31B engine (provisioned by OUR server — the Gemini API
 * key lives only in the Worker binding, never the browser bundle).
 *
 * Model split (verified against the live API on this key):
 *  - Gemma family (gemma-4-31b-it, gemma-4-26b-…) supports IMAGE input only.
 *    Audio modality is NOT enabled, so Gemma cannot transcribe audio.
 *  - Gemini Flash (gemini-flash-latest) accepts AUDIO + IMAGE and returns
 *    structured JSON — used for transcription.
 *
 * Therefore: Gemma 31B powers VIDEO UNDERSTANDING + CHAT (its strength);
 * a Gemini Flash model powers AUDIO TRANSCRIPTION. No OAuth involved in the
 * engine — auth is only used for feature gating.
 */

export const MODELS = {
  transcription: "gemini-flash-latest", // audio-capable, structured JSON
  videoAnalysis: "gemma-4-31b-it", // image-capable (Gemma)
  chat: "gemma-4-31b-it", // Gemma handles grounded chat well
} as const;

export interface TranscribeResult {
  segments: { start: number; end: number; text: string }[];
}

const getAi = (apiKey: string) => new GoogleGenAI({ apiKey });

const transcribeSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          start: { type: Type.NUMBER, description: "Start time in seconds" },
          end: { type: Type.NUMBER, description: "End time in seconds" },
          text: { type: Type.STRING, description: "Transcribed text content" },
        },
        required: ["start", "end", "text"],
      },
    },
  },
  required: ["segments"],
};

/** Audio transcription: base64 audio -> timestamped TranscriptData segments. */
export const transcribeAudio = async (
  apiKey: string,
  audioBase64: string,
  mimeType = "audio/wav"
): Promise<TranscribeResult> => {
  const ai = getAi(apiKey);
  const response = await ai.models.generateContent({
    model: MODELS.transcription,
    contents: {
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: "Transcribe this audio accurately. Break it down into natural sentence or phrase segments with precise timestamps.",
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: transcribeSchema,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from the model");
  return JSON.parse(text) as TranscribeResult;
};

/**
 * Video understanding: analyze extracted frames (base64 JPEGs) and return a
 * natural-language description. This is the Gemma 31B "video understanding"
 * role — not just transcription.
 */
export const analyzeVideoFrames = async (
  apiKey: string,
  frames: string[],
  prompt?: string
): Promise<string> => {
  const ai = getAi(apiKey);
  const imageParts = frames.map((frame) => ({
    inlineData: { mimeType: "image/jpeg", data: frame },
  }));
  const textPart = {
    text:
      prompt ||
      "Analyze these frames from a video. Describe what is happening, the mood, visual style, and any key information visible.",
  };
  const response = await ai.models.generateContent({
    model: MODELS.videoAnalysis,
    contents: { parts: [...imageParts, textPart] },
  });
  return response.text || "No analysis generated.";
};

/** Conversational assistant grounded in the transcript context. */
export const chatWithGemini = async (
  apiKey: string,
  history: { role: string; parts: { text: string }[] }[],
  message: string,
  context: string
): Promise<string> => {
  const ai = getAi(apiKey);
  const systemInstruction = `You are NeoScriber's AI Assistant.
You have access to the transcript of the media file the user is working on.

TRANSCRIPT CONTEXT:
${context}

Answer the user's questions based on the transcript context if applicable.
Keep answers concise, helpful, and friendly.`;

  const chat = ai.chats.create({
    model: MODELS.chat,
    history,
    config: { systemInstruction },
  });
  const response = await chat.sendMessage({ message });
  return response.text || "I couldn't generate a response.";
};
