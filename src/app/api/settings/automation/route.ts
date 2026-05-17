import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAutomationSetting, updateAutomationSetting } from "@/lib/services/settings";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const settings = await getAutomationSetting(user.id);
  return NextResponse.json({ settings });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  const settings = await updateAutomationSetting(user.id, await request.json().catch(() => ({})));
  await logAudit({ userId: user.id, action: "user_approved", entityType: "AutomationSetting", entityId: settings.id, metadata: { automationEnabled: settings.automationEnabled } });
  return NextResponse.json({ settings });
}
