import { NextResponse } from "next/server";
import { z } from "zod";

import { apiAuthStatus, requireApiAdmin } from "@/lib/auth/api";

const schema = z.object({
  action: z.enum([
    "approve_host", "reject_host",
    "community_publish", "community_hide", "community_delete", "member_suspend",
    "member_unsuspend", "member_revoke_host", "member_revoke_community_host",
    "member_restore_community_host", "report_reviewing", "report_resolved",
    "report_dismissed",
    "space_verification_approve","space_verification_revision","space_verification_reject",
    "space_suspend","space_unsuspend",
  ]),
  targetId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const { action, targetId, reason: rawReason } = schema.parse(await request.json());
    const reason = rawReason || null;
    const { admin, supabase, user } = await requireApiAdmin();
    if (action === "member_revoke_community_host" && !reason) {
      return NextResponse.json({ message: "커뮤니티 운영 권한 회수 사유를 입력해 주세요." }, { status: 400 });
    }

    if (action === "approve_host" || action === "reject_host") {
      const { error } = await supabase.rpc("process_space_host_application", {
        p_application_id: targetId,
        p_result: action === "approve_host" ? "approved" : "rejected",
        p_reason: reason,
      });
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }
    if(action.startsWith("space_verification_")){
      const result=action==="space_verification_approve"?"approved":action==="space_verification_revision"?"revision_requested":"rejected";
      if(result!=="approved"&&!reason)return NextResponse.json({message:"처리 사유를 입력해 주세요."},{status:400});
      const{error}=await supabase.rpc("review_space_verification",{p_request_id:targetId,p_action:result,p_reason:reason});
      if(error)throw error;
      return NextResponse.json({ok:true});
    }
    if(action==="space_suspend"||action==="space_unsuspend"){
      if(action==="space_suspend"&&!reason)return NextResponse.json({message:"공개 중지 사유를 입력해 주세요."},{status:400});
      const{error}=await supabase.rpc("set_space_suspension",{p_space_id:targetId,p_suspend:action==="space_suspend",p_reason:reason});
      if(error)throw error;
      return NextResponse.json({ok:true});
    }

    if (targetId === user.id && action === "member_suspend") {
      return NextResponse.json({ message: "\uC790\uC2E0\uC758 \uAD00\uB9AC\uC790 \uACC4\uC815\uC740 \uC815\uC9C0\uD560 \uC218 \uC5C6\uC5B4\uC694." }, { status: 400 });
    }

    let targetType: "community" | "profile" | "report";
    let patch: Record<string, unknown>;
    if (action.startsWith("community_")) {
      targetType = "community";
      patch = action === "community_publish"
        ? { status: "published", deleted_at: null, moderation_reason: reason }
        : action === "community_hide"
          ? { status: "inactive", moderation_reason: reason }
          : { status: "inactive", deleted_at: new Date().toISOString(), moderation_reason: reason };
    } else if (action.startsWith("member_")) {
      targetType = "profile";
      if (action === "member_suspend") patch = { account_status: "suspended", suspended_at: new Date().toISOString(), suspension_reason: reason };
      else if (action === "member_unsuspend") patch = { account_status: "active", suspended_at: null, suspension_reason: null };
      else if (action === "member_revoke_host") {
        const { data, error } = await admin.from("profiles").select("roles").eq("id", targetId).single();
        if (error) throw error;
        patch = { roles: (data.roles ?? []).filter((role: string) => role !== "space_host" && role !== "host_pending") };
      } else {
        const { data, error } = await admin.from("profiles").select("roles").eq("id", targetId).single();
        if (error) throw error;
        const roles = data.roles ?? [];
        const roleOrder = ["member", "community_host", "host_pending", "space_host", "admin"];
        patch = action === "member_revoke_community_host"
          ? { roles: roles.filter((role: string) => role !== "community_host"), community_host_revoked_at: new Date().toISOString(), community_host_revocation_reason: reason }
          : { roles: [...new Set([...roles, "community_host"])].sort((a, b) => roleOrder.indexOf(String(a)) - roleOrder.indexOf(String(b))), community_host_revoked_at: null, community_host_revocation_reason: null };
      }
    } else {
      targetType = "report";
      patch = { status: action.replace("report_", ""), processed_by: user.id, processed_at: new Date().toISOString(), resolution_note: reason };
    }

    const table = targetType === "community" ? "communities" : targetType === "profile" ? "profiles" : "reports";
    const update = await admin.from(table).update(patch).eq("id", targetId);
    if (update.error) throw update.error;
    const audit = await admin.from("admin_audit_logs").insert({ admin_id: user.id, action_type: action, target_type: targetType, target_id: targetId, reason });
    if (audit.error) throw audit.error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[MODIZA][admin] action failed", error);
    return NextResponse.json(
      { message: error instanceof z.ZodError ? "\uC694\uCCAD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." : "\uAD00\uB9AC\uC790 \uC791\uC5C5\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." },
      { status: apiAuthStatus(error) ?? 400 },
    );
  }
}
