import { NextResponse } from "next/server";
import type { ChannelEntry } from "@/types";
import { ChannelMeta } from "@/models/ChannelMeta";
import { ensureChannelMetaSchema } from "@/services/channelMetaService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  try {
    const { guildId } = await params;
    await ensureChannelMetaSchema();

    const rows = await ChannelMeta.findAll({ where: { guildID: guildId, isDeleted: false } });

    const channels: ChannelEntry[] = rows.map((row) => ({
      channelID: row.channelID,
      channelName: row.name,
      parentID: row.parentID,
      parentName: row.parentName,
      channelType: row.channelType,
    }));

    // Sort: categories first, then by parentName + name
    channels.sort((a, b) => {
      const aParent = a.parentName ?? "";
      const bParent = b.parentName ?? "";
      if (aParent !== bParent) return aParent.localeCompare(bParent);
      return a.channelName.localeCompare(b.channelName);
    });

    return NextResponse.json(channels);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
