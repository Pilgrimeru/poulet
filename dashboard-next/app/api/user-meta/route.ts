import { NextResponse } from "next/server";
import { bulkUpsertUserMetas, markUserDeleted, markUsersDeletedExcept, upsertUserMeta } from "@/services/userMetaService";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (Array.isArray(body?.rows)) {
      await bulkUpsertUserMetas(body.rows);
    } else {
      const { userID, guildID, username, displayName, avatarURL } = body;
      await upsertUserMeta(userID, guildID, username, displayName, avatarURL);
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    if (body?.guildID && Array.isArray(body?.activeUserIDs)) {
      await markUsersDeletedExcept(body.guildID, body.activeUserIDs);
    } else if (body?.userID && body?.guildID) {
      await markUserDeleted(body.userID, body.guildID);
    } else {
      return NextResponse.json({ error: "Missing userID+guildID or guildID+activeUserIDs" }, { status: 400 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
