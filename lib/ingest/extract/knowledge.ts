import type { KnowledgeSource } from "../types";

type ServiceHint = {
  name: string;
  kind: KnowledgeSource["kind"];
  pattern: RegExp;
};

const SERVICE_HINTS: ServiceHint[] = [
  { name: "OpenAI", kind: "integration", pattern: /OPENAI/ },
  { name: "Anthropic", kind: "integration", pattern: /ANTHROPIC/ },
  { name: "Google", kind: "integration", pattern: /GOOGLE|GEMINI|VERTEX/ },
  { name: "Azure OpenAI", kind: "integration", pattern: /AZURE/ },
  { name: "Groq", kind: "integration", pattern: /GROQ/ },
  { name: "Mistral", kind: "integration", pattern: /MISTRAL/ },
  { name: "Cohere", kind: "integration", pattern: /COHERE/ },
  { name: "Tavily", kind: "integration", pattern: /TAVILY/ },
  { name: "SerpAPI", kind: "integration", pattern: /SERP/ },
  { name: "Brave Search", kind: "integration", pattern: /BRAVE/ },
  { name: "Firecrawl", kind: "integration", pattern: /FIRECRAWL/ },
  { name: "Jina", kind: "integration", pattern: /JINA/ },
  { name: "Pinecone", kind: "vectorstore", pattern: /PINECONE/ },
  { name: "Chroma", kind: "vectorstore", pattern: /CHROMA/ },
  { name: "Weaviate", kind: "vectorstore", pattern: /WEAVIATE/ },
  { name: "Qdrant", kind: "vectorstore", pattern: /QDRANT/ },
  { name: "Milvus", kind: "vectorstore", pattern: /MILVUS/ },
  { name: "FAISS", kind: "vectorstore", pattern: /FAISS/ },
  { name: "PGVector", kind: "vectorstore", pattern: /PGVECTOR|POSTGRES.*VECTOR/ },
  { name: "Vector database", kind: "vectorstore", pattern: /VECTOR[_-]?DB/ },
  { name: "Supabase", kind: "integration", pattern: /SUPABASE/ },
  { name: "Redis", kind: "integration", pattern: /REDIS/ },
  { name: "MongoDB", kind: "integration", pattern: /MONGO/ },
  { name: "Postgres", kind: "integration", pattern: /POSTGRES|DATABASE_URL/ },
  { name: "Slack", kind: "integration", pattern: /SLACK/ },
  { name: "Discord", kind: "integration", pattern: /DISCORD/ },
  { name: "Twilio", kind: "integration", pattern: /TWILIO/ },
  { name: "WhatsApp", kind: "integration", pattern: /WHATSAPP/ },
  { name: "Telegram", kind: "integration", pattern: /TELEGRAM/ },
  { name: "LangSmith", kind: "integration", pattern: /LANGCHAIN|LANGSMITH|LANGGRAPH/ },
  { name: "AWS", kind: "integration", pattern: /AWS_|S3_|BEDROCK/ },
];

const SKIP_ENV =
  /^(PORT|HOST|NODE_ENV|DEBUG|LOG_LEVEL|CI|PATH|HOME|PYTHONPATH|PWD|TERM|SHELL|USER|EDITOR|NEXT_|VERCEL_)/;

const RETRIEVER_RE =
  /\b(PineconeVectorStore|Chroma(?:DB)?|Weaviate|Qdrant|Milvus|FAISS|PGVector|SupabaseVectorStore|OpenSearchVectorSearch|MongoDBAtlasVectorSearch|\.as_retriever\s*\(|asRetriever\s*\(|VectorStoreRetriever)\b/;

export function parseEnvExample(path: string, raw: string): KnowledgeSource[] {
  const sources: KnowledgeSource[] = [];
  const seen = new Set<string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    const key = (eq === -1 ? trimmed : trimmed.slice(0, eq)).trim();
    if (!key || SKIP_ENV.test(key)) continue;
    const upper = key.toUpperCase();
    for (const hint of SERVICE_HINTS) {
      if (!hint.pattern.test(upper)) continue;
      const id = `${hint.name}:${hint.kind}`;
      if (seen.has(id)) break;
      seen.add(id);
      sources.push({
        name: hint.name,
        kind: hint.kind === "vectorstore" ? "vectorstore" : hint.kind,
        detail: key,
        source: path,
      });
      break;
    }
  }
  return sources;
}

export function extractRetrievers(path: string, source: string): KnowledgeSource[] {
  const hits = source.match(new RegExp(RETRIEVER_RE.source, "g")) ?? [];
  const unique = [...new Set(hits.map((h) => h.replace(/\s*\(.*$/, "").replace(/^\./, "")))];
  return unique.map((name) => ({
    name: name.replace(/VectorStore|as_retriever|asRetriever/g, "").replace(/^\./, "") || name,
    kind: name.includes("retriever") || name.includes("Retriever") ? "retriever" : "vectorstore",
    detail: name,
    source: path,
  }));
}

export function mergeKnowledge(groups: KnowledgeSource[][]): KnowledgeSource[] {
  const byKey = new Map<string, KnowledgeSource>();
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.name.toLowerCase()}|${item.kind}`;
      if (!byKey.has(key)) byKey.set(key, item);
    }
  }
  return [...byKey.values()];
}
