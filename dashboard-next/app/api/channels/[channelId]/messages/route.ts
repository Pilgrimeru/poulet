import { NextResponse } from "next/server";
import { hydrateMessagesWithCurrentAuthors } from "@/services/discordMetaService";
import { getChannelMessages } from "@/services/messageSnapshotService";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  try {
    const { channelId } = await params;
    const url = new URL(req.url);
    const guildId = url.searchParams.get("guildId");
    if (!guildId) {
      return NextResponse.json({ error: "guildId query param is required" }, { status: 400 });
    }
    const limit = url.searchParams.get("limit");
    const before = url.searchParams.get("before");
    const after = url.searchParams.get("after");
    const search = url.searchParams.get("search");
    const authorID = url.searchParams.get("authorID");
    const onlyDeleted = url.searchParams.get("onlyDeleted");

    const messages = await getChannelMessages(
      guildId,
      channelId,
      limit ? parseInt(limit) : 50,
      {
        before: before ? parseInt(before) : undefined,
        after: after ? parseInt(after) : undefined,
        search: search ?? undefined,
        authorID: authorID ?? undefined,
        onlyDeleted: onlyDeleted === "true",
      },
    );
    return NextResponse.json(await hydrateMessagesWithCurrentAuthors(guildId, messages));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
