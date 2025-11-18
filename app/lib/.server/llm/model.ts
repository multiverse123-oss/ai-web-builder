import { MistralPrivate } from "@mistralai/mistralai-private";

export function createMistralClient(apiKey: string) {
  return new MistralPrivate({ 
    serverURL: "https://api.mistral.ai/", 
    apiKey: apiKey, 
  });
}

export async function streamMistralResponse(messages: any[], apiKey: string) {
  const client = createMistralClient(apiKey);
  
  // Convert messages to Mistral format
  const mistralMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  const response = await client.beta.conversations.startStream({ 
    agentId: "ag_019a547f372272cc853caa9bd1bf2640", 
    inputs: mistralMessages,
  });

  return response;
}
