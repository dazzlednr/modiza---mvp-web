import { NextResponse } from "next/server";
import { requireApiAdmin, apiAuthStatus } from "@/lib/auth/api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireApiAdmin();
    const { data, error } = await admin.from("space_host_applications").select("evidence_path,evidence_paths").eq("id", (await params).id).single();
    const paths = Array.isArray(data?.evidence_paths) && data.evidence_paths.length
      ? data.evidence_paths
      : data?.evidence_path ? [data.evidence_path] : [];
    const index = Number(new URL(request.url).searchParams.get("index") ?? "0");
    const path = Number.isInteger(index) ? paths[index] : null;
    if (error || !path) return NextResponse.json({ message: "첨부 자료가 없어요." }, { status: 404 });
    const signed = await admin.storage.from("space-host-evidence").createSignedUrl(path, 60);
    if (signed.error) throw signed.error;
    return NextResponse.redirect(signed.data.signedUrl);
  } catch (error) {
    return NextResponse.json({ message: "증빙자료를 열 수 없어요." }, { status: apiAuthStatus(error) ?? 500 });
  }
}
