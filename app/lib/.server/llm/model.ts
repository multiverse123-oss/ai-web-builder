
import { Mistral } from "@mistralai/mistralai";

export function createMistralClient(apiKey: string) {
  return new Mistral(apiKey);
}

export async function streamMistralResponse(messages: any[], apiKey: string) {
  const client = createMistralClient(apiKey);
  
  // Convert messages to Mistral format
  const mistralMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  // Use chat completion instead of agents for the public package
  const response = await client.chat.stream({
    model: "mistral-large-latest", // You can change this to other models
    messages: mistralMessages,
    max_tokens: 8192,
    stream: true
  });

  return response;
}
