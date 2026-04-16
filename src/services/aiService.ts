import { GoogleGenAI, Type } from "@google/genai";
import { CodeProject } from "../types";

const SYSTEM_INSTRUCTION = `You are an elite Senior AI Web Developer and Product Designer. 
Your goal is to help users brainstorm, design, and build production-grade web applications.

Capabilities:
- Brainstorming: Help users refine their ideas, suggest features, and plan UI/UX.
- Code Generation: Generate complete, responsive, and accessible HTML/CSS/JS.
- Debugging: Analyze errors and provide precise fixes.
- Optimization: Improve performance and code quality.

Response Format:
You must ALWAYS respond in JSON format:
{
  "type": "chat" | "code" | "fix",
  "explanation": "Your response or technical breakdown",
  "code": {
    "html": "...",
    "css": "...",
    "js": "..."
  } (optional, only if type is 'code' or 'fix')
}

Strict Guidelines:
- If the user is just "chatting" or "brainstorming", set type to "chat" and omit the "code" object.
- If generating code, set type to "code" and provide the full code for all 3 files.
- If fixing an error, set type to "fix", explain the fix, and provide the corrected full code.
- Use modern ES6+, Flexbox/Grid, and semantic HTML.
- You can use Tailwind CSS via CDN if requested or for complex layouts.
- For images, use https://picsum.photos.
`;

export class AIService {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async processRequest(prompt: string, history: { role: string; parts: { text: string }[] }[] = []): Promise<{ type: 'chat' | 'code' | 'fix'; explanation: string; code?: CodeProject }> {
    const model = "gemini-3.1-pro-preview";
    
    const response = await this.ai.models.generateContent({
      model,
      contents: [
        ...history,
        { role: "user", parts: [{ text: prompt }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, enum: ["chat", "code", "fix"] },
            explanation: { type: Type.STRING },
            code: {
              type: Type.OBJECT,
              properties: {
                html: { type: Type.STRING },
                css: { type: Type.STRING },
                js: { type: Type.STRING }
              },
              required: ["html", "css", "js"]
            }
          },
          required: ["type", "explanation"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  }
}

export const aiService = new AIService();
