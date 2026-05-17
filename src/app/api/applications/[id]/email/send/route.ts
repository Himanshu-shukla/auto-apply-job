import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { sendEmailApplication } from "@/lib/services/emailApplications";
import { createNotification } from "@/lib/services/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  try {
    const emailApplication = await sendEmailApplication(user.id, params.id, await request.json().catch(() => ({})));
    return NextResponse.json({ emailApplication });
  } catch (error) {
    await createNotification({
      userId: user.id,
      type: "send_failed",
      title: "Email send blocked",
      message: error instanceof Error ? error.message : "Email send failed.",
      link: `/applications/${params.id}`
    });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Email send failed." }, { status: 400 });
  }
}
