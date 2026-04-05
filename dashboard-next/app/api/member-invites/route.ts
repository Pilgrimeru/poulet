import { NextResponse } from "next/server";
import { MemberInvite } from "@/models/MemberInvite";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guildID = searchParams.get("guildID");
    const userID = searchParams.get("userID");
    if (!guildID || !userID) {
      return NextResponse.json({ error: "Missing guildID or userID" }, { status: 400 });
    }
    const row = await MemberInvite.findOne({ where: { guildID, userID } } as any);
    if (!row) return NextResponse.json(null);
    return NextResponse.json({
      inviterID: row.inviterID,
      inviterTag: row.inviterTag,
      code: row.code,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { guildID, userID, inviterID, inviterTag, code } = await req.json();
    await MemberInvite.upsert({ guildID, userID, inviterID, inviterTag, code } as any);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const guildID = searchParams.get("guildID");
    const userID = searchParams.get("userID");
    if (!guildID || !userID) {
      return NextResponse.json({ error: "Missing guildID or userID" }, { status: 400 });
    }
    await MemberInvite.destroy({ where: { guildID, userID } } as any);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
