import { type ActionFunctionArgs } from '@remix-run/cloudflare';
import { streamMistralResponse } from '~/lib/.server/llm/model';
import { getAPIKey } from '~/lib/.server/llm/api-key';
import { MAX_RESPONSE_SEGMENTS } from '~/lib/.server/llm/constants';
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
    const onFinish = async (content: string) => {
      if (stream.switches >= MAX_RESPONSE_SEGMENTS) {
        throw Error('Cannot continue message: Maximum segments reached');
      }

      const switchesLeft = MAX_RESPONSE_SEGMENTS - stream.switches;
      console.log(`Continuing message (${switchesLeft} switches left)`);

      messages.push({ role: 'assistant', content });
      messages.push({ role: 'user', content: CONTINUE_PROMPT });

      const newResponse = await streamMistralResponse(messages, apiKey);
      return stream.switchSource(await convertMistralStreamToReadable(newResponse));
    };

    const result = await streamMistralResponse(messages, apiKey);
    stream.switchSource(await convertMistralStreamToReadable(result, onFinish));

    return new Response(stream.readable, {
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

async function convertMistralStreamToReadable(
  mistralStream: any, 
  onFinish?: (content: string) => Promise<void>
) {
  let accumulatedContent = '';

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of mistralStream) {
          if (chunk.data?.choices?.[0]?.delta?.content) {
            const content = chunk.data.choices[0].delta.content;
            accumulatedContent += content;
            controller.enqueue(new TextEncoder().encode(content));
          }
          
          // Check if this is the final chunk
          if (chunk.data?.choices?.[0]?.finish_reason) {
            const finishReason = chunk.data.choices[0].finish_reason;
            
            if (finishReason === 'length' && onFinish) {
              controller.close();
              await onFinish(accumulatedContent);
              return;
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}
