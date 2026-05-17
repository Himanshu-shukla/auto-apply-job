import { NextRequest, NextResponse } from "next/server";
import { getDemoUser } from "@/lib/auth";
import { getEmailSetting, updateEmailSetting } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getDemoUser();
  const settings = await getEmailSetting(user.id);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const user = await getDemoUser();
  const settings = await updateEmailSetting(user.id, await request.json().catch(() => ({})));
  return NextResponse.json({ settings });
}
