import { NextResponse } from "next/server";
import { getAutoResponseByID, updateAutoResponse, deleteAutoResponse } from "@/services/autoResponseService";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> },
) {
  try {
    const { guildId, id } = await params;
    const rule = await getAutoResponseByID(guildId, id);
    return rule ? NextResponse.json(rule) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> },
) {
  try {
    const { guildId, id } = await params;
    const body = await req.json();
    const rule = await updateAutoResponse(guildId, id, body);
    return rule ? NextResponse.json(rule) : NextResponse.json(null, { status: 404 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ guildId: string; id: string }> },
) {
  try {
    const { guildId, id } = await params;
    const deleted = await deleteAutoResponse(guildId, id);
    return NextResponse.json({ deleted });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
