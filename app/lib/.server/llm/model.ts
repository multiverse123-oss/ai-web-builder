import { MistralPrivate } from "@mistralai/mistralai-private";

export function createMistralClient() {
  return new MistralPrivate({ 
    serverURL: "https://api.mistral.ai/", 
    apiKey: process.env.MISTRAL_API_KEY || "", 
  });
}

export async function streamMistralResponse(input: string) {
  const client = createMistralClient();
  
  const response = await client.beta.conversations.startStream({ 
    agentId: "ag_019a547f372272cc853caa9bd1bf2640", 
    inputs: input, 
  });

  return response;
}
