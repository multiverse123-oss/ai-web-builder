import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamMistralResponse } from '~/lib/.server/llm/model';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/lib/.server/llm/constants';
import { CONTINUE_PROMPT } from '~/lib/.server/llm/prompts';
import SwitchableStream from '~/lib/.server/llm/switchable-stream';

export async function action(args: ActionFunctionArgs) {
  return chatAction(args);
}

async function chatAction({ context, request }: ActionFunctionArgs) {
  const { messages } = await request.json<{ messages: any[] }>();
  const apiKey = getAPIKey(context.cloudflare.env);

  if (!apiKey) {
    throw new Response('Mistral API key not configured', { status: 500 });
  }

  const stream = new SwitchableStream();

  try {
    const onFinish = async ({ content, finishReason }: { content: string, finishReason: string }) => {
      if (finishReason !== 'length') {
        return stream.close();
      }

      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;

      console.log(`Reached max token limit (${MAX_TOKENS}): Continuing message (${switchesLeft} switches left)`);

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });

      const newResponse = await streamMistralResponse(messages, apiKey);
      return stream.switchSource(newResponse);
    };

    const result = await streamMistralResponse(messages, apiKey);
    stream.switchSource(result);

    // Handle the streaming response
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result) {
            // You'll need to adjust this based on the actual chunk structure from Mistral
            const text = chunk.choices?.[0]?.delta?.content || '';
            if (text) {
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(readableStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (error) {
    console.log(error);
    throw new Response(null, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
