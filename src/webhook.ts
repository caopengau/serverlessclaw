import { APIGatewayProxyEventV2 } from 'aws-lambda';
import { DynamoMemory, Message } from './memory';
import { Resource } from 'sst';
import { tools, getToolDefinitions } from './tools';

const memory = new DynamoMemory();

export const handler = async (event: APIGatewayProxyEventV2) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  if (!event.body) {
    return { statusCode: 400, body: 'Missing body' };
  }

  const update = JSON.parse(event.body);
  const message = update.message;

  if (!message || !message.text) {
    return { statusCode: 200, body: 'OK' };
  }

  const chatId = message.chat.id.toString();
  const userText = message.text;

  // 1. Get history
  const history = await memory.getHistory(chatId);

  // 2. Add user message to history
  const userMessage: Message = { role: 'user', content: userText };
  await memory.addMessage(chatId, userMessage);

  // 3. Process with LLM and potential tools
  const currentMessages: any[] = [
    {
      role: 'system',
      content: 'You are a helpful AI agent. You think step by step. Use tools if needed.',
    },
    ...history,
    userMessage,
  ];

  let responseText = '';
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    const aiResponse = await callLLM(currentMessages);

    if (aiResponse.tool_calls) {
      currentMessages.push(aiResponse);

      for (const toolCall of aiResponse.tool_calls) {
        const tool = tools[toolCall.function.name];
        if (tool) {
          const args = JSON.parse(toolCall.function.arguments);
          const result = await tool.execute(args);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            content: result,
          });
        }
      }
      iterations++;
    } else {
      responseText = aiResponse.content;
      break;
    }
  }

  if (!responseText) responseText = 'Sorry, I reached my iteration limit.';

  // 4. Save response to history
  await memory.addMessage(chatId, { role: 'assistant', content: responseText });

  // 5. Send response to Telegram
  await sendTelegramMessage(chatId, responseText);

  return { statusCode: 200, body: 'OK' };
};

async function callLLM(messages: any[]): Promise<any> {
  const apiKey = Resource.OpenAIApiKey.value;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-5-mini',
      messages: messages,
      tools: getToolDefinitions(),
    }),
  });

  const data = (await response.json()) as any;
  return data.choices?.[0]?.message;
}

async function sendTelegramMessage(chatId: string, text: string) {
  const token = Resource.TelegramBotToken.value;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
    }),
  });
}
