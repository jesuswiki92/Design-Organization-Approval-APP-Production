import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type ChatHistoryItem = {
  role: "user" | "assistant" | "system";
  content: string;
};

type CertificationMatchRow = {
  id?: string | number | null;
  title?: string | null;
  document_title?: string | null;
  source_document?: string | null;
  section?: string | null;
  heading?: string | null;
  score?: number | null;
  similarity?: number | null;
  content?: string | null;
  chunk_text?: string | null;
};

type SourceItem = {
  id: string;
  title: string;
  section: string;
  score: number | null;
  content: string;
};

const SYSTEM_PROMPT =
  "You are an EASA aeronautical certification expert. Answer questions based on the provided documentation context. Always cite the source documents. Respond in the same language as the question.";

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
    .slice(-10);
}

function normalizeSources(rows: CertificationMatchRow[] | null | undefined): SourceItem[] {
  return (rows ?? []).map((row, index) => ({
    id: String(row.id ?? index),
    title:
      row.title?.trim() ||
      row.document_title?.trim() ||
      row.source_document?.trim() ||
      "Documento sin titulo",
    section: row.section?.trim() || row.heading?.trim() || "Seccion no especificada",
    score:
      typeof row.score === "number"
        ? row.score
        : typeof row.similarity === "number"
          ? row.similarity
          : null,
    content: row.content?.trim() || row.chunk_text?.trim() || "",
  }));
}

function buildContext(sources: SourceItem[]) {
  if (sources.length === 0) {
    return "No relevant certification documentation was retrieved.";
  }

  return sources
    .map((source, index) => {
      const scoreLabel =
        typeof source.score === "number" ? ` | score: ${source.score.toFixed(3)}` : "";

      return [
        `[Chunk ${index + 1}] ${source.title} | ${source.section}${scoreLabel}`,
        source.content,
      ].join("\n");
    })
    .join("\n\n");
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: unknown;
      session_id?: unknown;
      history?: unknown;
    };

    const question = typeof body.question === "string" ? body.question.trim() : "";
    if (!question) {
      return jsonResponse(400, "Question is required.");
    }

    if (!process.env.GOOGLE_API_KEY) {
      return jsonResponse(500, "GOOGLE_API_KEY is not configured.");
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return jsonResponse(500, "OPENROUTER_API_KEY is not configured.");
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    const embeddingResult = await ai.models.embedContent({
      model: "gemini-embedding-exp-03-07",
      contents: question,
    });
    const embedding = embeddingResult.embeddings?.[0]?.values;

    if (!embedding?.length) {
      return jsonResponse(500, "Failed to generate the query embedding.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("match_documentacion_certificacion", {
      query_embedding: embedding,
      match_count: 6,
      match_threshold: 0.5,
    });

    if (error) {
      throw new Error(`Supabase RPC failed: ${error.message}`);
    }

    const sources = normalizeSources((data as CertificationMatchRow[] | null) ?? []);
    const context = buildContext(sources);
    const history = normalizeHistory(body.history);

    const openai = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    });

    const completion = await openai.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      stream: true,
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.map((item) => ({
          role: item.role,
          content: item.content,
        })),
        {
          role: "user",
          content: [
            "Certification documentation context:",
            context,
            "",
            `Question: ${question}`,
            "",
            "Instructions: cite the source documents you used.",
          ].join("\n"),
        },
      ],
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let fullAnswer = "";

        try {
          controller.enqueue(encoder.encode(sseEvent("sources", { sources })));

          for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content ?? "";

            if (!token) {
              continue;
            }

            fullAnswer += token;
            controller.enqueue(encoder.encode(sseEvent("token", { token })));
          }

          controller.enqueue(
            encoder.encode(
              sseEvent("done", {
                answer: fullAnswer,
                session_id: typeof body.session_id === "string" ? body.session_id : null,
              }),
            ),
          );
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
