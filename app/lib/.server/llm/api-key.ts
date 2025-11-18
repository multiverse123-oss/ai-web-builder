import { env } from 'node:process';

export function getAPIKey(cloudflareEnv: Env) {
  return env.MISTRAL_API_KEY || cloudflareEnv.MISTRAL_API_KEY;
}
