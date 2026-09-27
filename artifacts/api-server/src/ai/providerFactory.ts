import { AIProvider } from "./types.js";
import { MockAIProvider } from "./providers/mockProvider.js";
import { OpenAICompatibleAIProvider } from "./providers/openaiProvider.js";

export function getAIProvider(): AIProvider {
  const providerType = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const apiKey = process.env.AI_API_KEY || "";
  const model = process.env.AI_MODEL || "mock-grounded-v1";
  const endpoint = process.env.AI_API_ENDPOINT || undefined;

  if ((providerType === "openai" || providerType === "gemini" || providerType === "custom") && apiKey) {
    return new OpenAICompatibleAIProvider(apiKey, model, endpoint, providerType);
  }

  // Default / fallback to grounded Mock AI provider
  return new MockAIProvider();
}
