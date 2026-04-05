import { NextResponse } from "next/server";
import { getUserMessages } from "@/services/messageSnapshotService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ guildId: string; userId: string }> },
) {
  try {
    const { guildId, userId } = await params;
    const url = new URL(req.url);

    const limit     = url.searchParams.get("limit");
    const startDate = url.searchParams.get("startDate");
    const endDate   = url.searchParams.get("endDate");
    const onlyDeleted = url.searchParams.get("onlyDeleted");
    const channelID = url.searchParams.get("channelID");
    const search = url.searchParams.get("search");
    const searchTerms = url.searchParams.get("searchTerms");
    const searchMode = url.searchParams.get("searchMode");

    let parsedSearchTerms: string[] | undefined;
    if (searchTerms) {
      try {
        const parsed = JSON.parse(searchTerms);
        if (Array.isArray(parsed)) {
          parsedSearchTerms = parsed.map((term) => String(term).trim()).filter(Boolean);
        }
      } catch {}
    }

    const messages = await getUserMessages(
      guildId,
      userId,
      limit ? parseInt(limit) : 50,
      {
        startDate:   startDate   ? parseInt(startDate)   : undefined,
        endDate:     endDate     ? parseInt(endDate)     : undefined,
        onlyDeleted: onlyDeleted === "true",
        channelID:   channelID   ?? undefined,
        search:      search?.trim() ? search : undefined,
        searchTerms: parsedSearchTerms?.length ? parsedSearchTerms : undefined,
        searchMode:  searchMode === "all" ? "all" : searchMode === "any" ? "any" : undefined,
      },
    );

    return NextResponse.json(messages);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
