import OpenAI from "openai";
import { NextRequest } from "next/server";

import { requireUserApi } from "@/lib/auth/require-user";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

const SYSTEM_PROMPT = [
  "You are a helpful DOA engineering assistant for aerospace certification teams.",
  "Answer clearly and practically in the same language as the user.",
  "Do not claim to have searched company documents or databases.",
  "If the user asks for regulated or compliance-sensitive guidance, be explicit about assumptions and limits.",
].join(" ");

const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4";

function jsonResponse(status: number, error: string) {
  return Response.json({ error }, { status });
}

function normalizeHistory(history: unknown): ChatHistoryItem[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter((item): item is ChatHistoryItem => {
      if (!item || typeof item !== "object") {
        return false;
      }

      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;

      return (
        (role === "user" || role === "assistant" || role === "system") &&
        typeof content === "string" &&
        content.trim().length > 0
      );
    })
    .slice(-12);
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUserApi();
    if (auth instanceof Response) return auth;

    const body = (await request.json()) as {
      question?: unknown;
      history?: unknown;
    };

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return jsonResponse(400, "Question is required.");
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, "OPENROUTER_API_KEY is not configured.");
    }

    const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
    const history = normalizeHistory(body.history);

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await openai.chat.completions.create(
      {
        model,
        stream: true,
        temperature: 0.3,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...history.map((item) => ({
            role: item.role,
            content: item.content,
          })),
          { role: "user", content: question },
        ],
      },
      {
        headers: {
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "DOA Operations Hub",
        },
      },
    );

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullAnswer = "";

        try {
          controller.enqueue(encoder.encode(sseEvent("meta", { model })));

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content ?? "";

            if (!token) {
              continue;
            }

            fullAnswer += token;
            controller.enqueue(encoder.encode(sseEvent("token", { token })));
          }

          controller.enqueue(encoder.encode(sseEvent("done", { answer: fullAnswer, model })));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unexpected error while streaming.";
          controller.enqueue(encoder.encode(sseEvent("error", { error: message })));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return jsonResponse(500, message);
  }
}
