import { NextRequest, NextResponse } from "next/server";
import { chatWithLLM, LLMServiceError, type LLMResult } from "@/lib/llm";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
}

async function generateAIResponse(messages: ChatMessage[]): Promise<LLMResult> {
  const systemPrompt = `You are a helpful AI coding assistant. You help developers with:
- Code explanations and debugging
- Best practices and architecture advice
- Writing clean, efficient code
- Troubleshooting errors
- Code reviews and optimizations

Always provide clear, practical answers. Use proper code formatting when showing examples.`;

  return chatWithLLM(
    [{ role: "system", content: systemPrompt }, ...messages],
    { maxTokens: 1000 },
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const { message, history = [] } = body as Partial<ChatRequest>;
  if (typeof message !== "string" || !message.trim() || message.length > 20000) {
    return NextResponse.json(
      { error: "Message must be a non-empty string of at most 20,000 characters." },
      { status: 400 },
    );
  }

  try {
    const validHistory = Array.isArray(history)
      ? history.filter(
          (msg) =>
            msg &&
            typeof msg === "object" &&
            typeof msg.role === "string" &&
            typeof msg.content === "string" &&
            msg.content.length <= 20000 &&
            ["user", "assistant"].includes(msg.role),
        )
      : [];

    const recentHistory = validHistory.slice(-10);
    const messages: ChatMessage[] = [
      ...recentHistory,
      { role: "user", content: message.trim() },
    ];

    const result = await generateAIResponse(messages);

    return NextResponse.json({
      response: result.content,
      model: result.model,
      tokens: result.tokens,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof LLMServiceError
            ? error.message
            : "AI service is temporarily unavailable. Please try again.",
        timestamp: new Date().toISOString(),
      },
      { status: error instanceof LLMServiceError ? error.status : 500 },
    );
  }
}
