import { handler } from "./src/webhook";

// Mocking Resource for local test
// In a real SST environment, these are injected
(global as any).process.env.SST_RESOURCE_MemoryTable = JSON.stringify({ name: "local-table" });
(global as any).process.env.SST_RESOURCE_TelegramBotToken = JSON.stringify({ value: "mock-token" });
(global as any).process.env.SST_RESOURCE_OpenAIApiKey = JSON.stringify({ value: process.env.OPENAI_API_KEY || "mock-key" });

const mockEvent: any = {
  body: JSON.stringify({
    message: {
      chat: { id: 12345 },
      text: "What is 2 + 2 * 3?"
    }
  })
};

async function runTest() {
  console.log("Running local test...");
  try {
    const result = await handler(mockEvent);
    console.log("Test result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test failed:", error);
  }
}

runTest();
