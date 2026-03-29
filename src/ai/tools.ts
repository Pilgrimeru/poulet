import { DuckDuckGoSearch } from "@langchain/community/tools/duckduckgo_search";

export const duckduckgoTool = new DuckDuckGoSearch({ maxResults: 3 });
