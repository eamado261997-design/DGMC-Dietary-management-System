import { GoogleGenAI } from "@google/genai";
import { apiCache } from "../utils/apiUtils.js";

export class AIController {
  public async generateInsights(prompt: string): Promise<string> {
    const cacheKey = `ai_insight:${prompt}`;
    const cached = apiCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return "Gemini AI API key is not configured. Simulated insight: Cafeteria peak load is concentrated between 12:00 PM and 1:30 PM. Recommended actions include staggered departmental lunch schedules and pre-allocating night-shift meal kits.";
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      const text = response.text || "No insights generated.";
      apiCache.set(cacheKey, text, 300); // Cache for 5 minutes
      return text;
    } catch (err: any) {
      console.error("Gemini AI API Error:", err);
      const msg = err.message || "";
      if (msg.includes("resource_exhausted") || msg.includes("quota") || msg.includes("429") || msg.includes("Rate exceeded")) {
        return "AI API quota limit currently reached. Simulated operational insight: Cafeteria traffic peaks between 12:15 PM and 1:15 PM. Recommended actions include staggered departmental lunch breaks and pre-packaging high-demand meal trays to minimize queue waiting times.";
      }
      throw new Error(err.message || "Failed to generate AI insights");
    }
  }
}
