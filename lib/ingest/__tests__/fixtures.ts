/** Fixtures modeled on the LangGraph test corpus conventions — not full clones. */

export const AGENT_SERVICE_TOOLKIT = {
  "langgraph.json": JSON.stringify(
    {
      python_version: "3.12",
      dependencies: ["./src"],
      graphs: {
        research_assistant: "./src/agents/research_assistant.py:research_assistant",
        supervisor: "./src/agents/supervisor.py:supervisor",
      },
      env: "./.env",
    },
    null,
    2
  ),
  "src/agents/research_assistant.py": `
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.tools import tool

SYSTEM_PROMPT = """You are a research assistant. Always cite sources.
Never fabricate references. Use the search tool for current events.
If the question is ambiguous, ask a clarifying question before searching.
"""

RESEARCH_INSTRUCTIONS = """Search thoroughly. Summarize findings in markdown.
Never include confidential internal notes in the output.
"""

checkpointer = MemorySaver()
model = "gpt-4o"

research_assistant = create_react_agent(model, tools=[web_search, fetch_url], checkpointer=checkpointer)
`,
  "src/agents/supervisor.py": `
SUPERVISOR_PROMPT = """You are the supervisor. Delegate research to the research_assistant graph.
Escalate to a human when the user asks to publish externally.
"""
`,
  "src/tools.py": `
from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """Search the public web for current information."""
    return ""

@tool
def fetch_url(url: str) -> str:
    """Fetch and read a URL. Read-only."""
    return ""

@tool
def delete_index(name: str) -> str:
    """Delete a vector index. Destructive."""
    return ""

def calculator_func(expression: str) -> str:
    """Calculates a math expression using numexpr."""
    return "0"

calculator = tool(calculator_func)
calculator.name = "Calculator"
`,
  "src/configuration.py": `
DEFAULT_MODEL = "gpt-4o"
temperature = 0.0
max_tokens = 4096
max_retries = 3
`,
  ".env.example": `
OPENAI_API_KEY=
TAVILY_API_KEY=
PINECONE_API_KEY=
LANGCHAIN_API_KEY=
`,
};

export const PDF_CHATBOT_TS = {
  "langgraph.json": JSON.stringify({
    node_version: "20",
    graphs: {
      agent: "./src/agent.ts:graph",
    },
    env: ".env",
  }),
  "package.json": JSON.stringify({
    dependencies: {
      "@langchain/langgraph": "^0.2.0",
      "@langchain/openai": "^0.3.0",
    },
  }),
  "src/agent.ts": `
import { tool } from "@langchain/core/tools";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";

export const SYSTEM_PROMPT = \`You are a PDF research assistant.
Always ground answers in retrieved document chunks.
Never invent citations. If the documents do not contain the answer, say so.
\`;

const checkpointer = new MemorySaver();
export const graph = createReactAgent({ llm: model, tools: [searchDocs], checkpointer });
`,
  "src/tools.ts": `
import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const searchDocs = tool(async ({ query }) => {
  return "";
}, {
  name: "searchDocs",
  description: "Search ingested PDF chunks in the vector store",
  schema: z.object({ query: z.string() }),
});
`,
  "src/retriever.ts": `
import { PineconeVectorStore } from "@langchain/pinecone";
const retriever = store.asRetriever();
`,
  ".env.example": `
OPENAI_API_KEY=
PINECONE_API_KEY=
`,
};

export const HIA_NO_MANIFEST = {
  "requirements.txt": "langchain>=0.2\nlanggraph>=0.2\n",
  "prompts.py": `
SYSTEM_PROMPT = """You are HIA, a helpful intern assistant.
Always confirm before sending email. Never share passwords.
"""
`,
  "tools.py": `
from langchain_core.tools import tool

@tool
def send_email(to: str, body: str) -> str:
    """Send an email to a recipient."""
    return "sent"
`,
  "graph.py": `
from langgraph.graph import StateGraph
graph = StateGraph(State)
`,
};

export const COOKBOOK_PARTIAL = {
  "README.md": "# cookbook examples",
  "examples/agent.py": `
from langchain_openai import ChatOpenAI
template = "You are a demo agent. Be helpful."
`,
};

export const NOTEBOOK_AGENT = {
  "financial_genius.ipynb": JSON.stringify({
    cells: [
      {
        cell_type: "code",
        source: [
          'SYSTEM_PROMPT = """You are a financial research agent. Always disclose that you are not a fiduciary.\\nNever execute trades."""\n',
        ],
      },
      {
        cell_type: "code",
        source: [
          "from langchain_core.tools import tool\n",
          "@tool\n",
          "def get_price(ticker: str) -> str:\n",
          '    """Look up a stock price."""\n',
          "    return '0'\n",
        ],
      },
    ],
  }),
  "requirements.txt": "langchain\n",
};

export const MINIMAL_HOMEGROWN = {
  "main.py": `
import openai
client = openai.OpenAI()
def run(msg):
    return client.chat.completions.create(model="gpt-4o-mini", messages=[{"role":"user","content":msg}])
`,
};

export const LARGE_MONOREPO: Record<string, string> = {
  "README.md": "monorepo",
  "apps/web/package.json": '{"name":"web"}',
  "apps/api/package.json": '{"name":"api"}',
  "packages/ui/package.json": '{"name":"ui"}',
  "packages/utils/package.json": '{"name":"utils"}',
  "services/billing/package.json": '{"name":"billing"}',
};
for (let i = 0; i < 850; i += 1) {
  LARGE_MONOREPO[`packages/lib/file_${i}.ts`] = `export const n${i} = ${i};`;
}
