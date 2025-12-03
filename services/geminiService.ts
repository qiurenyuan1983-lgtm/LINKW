import { GoogleGenAI } from "@google/genai";
import { LocationRule } from '../types';

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    // Safely check for API key to prevent runtime errors in environments where 'process' is not defined.
    const apiKey = (typeof process !== 'undefined' && process.env && process.env.API_KEY) ? process.env.API_KEY : undefined;

    if (!apiKey) {
      // The alert remains as a fallback for users in environments where the key isn't set.
      // This won't be shown if the key is correctly injected.
      alert("Gemini API key is not configured. The AI assistant is disabled.");
      return null;
    }
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
  return ai;
};

export async function runChatQuery(prompt: string, rulesContext: LocationRule[]): Promise<string> {
  const genAI = getAI();
  if (!genAI) {
    return "AI service is not available. Please configure the API key.";
  }

  // Create a summarized context to keep the prompt efficient
  const summary = {
    totalLocations: rulesContext.length,
    locationsWithStock: rulesContext.filter(r => (r.curPallet || 0) > 0).length,
    totalPallets: rulesContext.reduce((acc, r) => acc + (r.curPallet || 0), 0),
    totalCapacity: rulesContext.reduce((acc, r) => acc + (r.maxPallet || 0), 0),
  };

  const utilization = summary.totalCapacity > 0 ? Math.round((summary.totalPallets / summary.totalCapacity) * 100) : 0;

  const systemInstruction = `You are a helpful and witty warehouse management assistant named "Linky".
- Your purpose is to help users understand the warehouse status and find locations for pallets.
- Answer questions based ONLY on the provided warehouse data context.
- Be concise and clear. Format lists or tables as markdown for readability.
- If you perform a calculation, explain it briefly.
- If you cannot answer from the provided data, say so politely.
- The current date is ${new Date().toLocaleDateString()}.
- When asked to find a location, you must use the provided 'bestLocationSuggestion' if available. This is the optimal choice calculated by the system.
- Your personality is professional but friendly.`;

  // Filter rules to only those with stock to reduce prompt size, but also include some empty ones for context.
  const relevantRules = rulesContext.filter(r => (r.curPallet || 0) > 0);
  const emptyRules = rulesContext.filter(r => (r.curPallet || 0) === 0).slice(0, 20); // Add a sample of empty locations
  const contextForLLM = [...relevantRules, ...emptyRules].map(({ range, type, destinations, maxPallet, curPallet, note }) => ({
    range, type, destinations, maxPallet, curPallet, note
  }));


  const fullPrompt = `CONTEXT:
Warehouse Status Summary:
- Overall Utilization: ${utilization}%
- Total Locations: ${summary.totalLocations}
- Locations with stock: ${summary.locationsWithStock}
- Total Pallets: ${summary.totalPallets} / ${summary.totalCapacity}

Detailed Location Data (sample):
${JSON.stringify(contextForLLM, null, 2)}

USER QUERY: "${prompt}"

Based on the context, please provide a helpful response.`;

  try {
    const response = await genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: fullPrompt,
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.2, // Lower temperature for more deterministic, factual answers
        }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "There was an error contacting the AI service. Please check the console for details.";
  }
}