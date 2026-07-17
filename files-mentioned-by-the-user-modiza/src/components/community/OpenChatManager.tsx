"use client";

import { CheckCircle2, ExternalLink, Link2, LoaderCircle, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function OpenChatManager({ communityId, setup = false, nextPath = "" }: { communityId: string; setup?: boolean; nextPath?: string }) {
  const router = useRouter();
  const [communityName, setCommunityName] = useState("");
  const [url, setUrl] = useState("");
  const [registered, setRegistered] = useState(false);
  const [editing, setEditing] = useState(setup);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const response = await fetch(`/api/communities/${communityId}/open-chat`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) { setError(data.message); setLoading(false); return; } setCommunityName(data.communityName); setRegistered(data.registered); setUrl(data.openChatUrl ?? ""); if (!data.registered) setEditing(true); setLoading(false); }, [communityId]);
  useEffect(() => { const frame = requestAnimationFrame(() => void load()); return () => cancelAnimationFrame(frame); }, [load]);
  const completionPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/dashboard/communities";
  async function save() { setSaving(true); setError(""); const response = await fetch(`/api/communities/${communityId}/open-chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openChatUrl: url }) }); const data = await response.json(); if (!response.ok) { setError(data.message); setSaving(false); return; } setRegistered(true); setEditing(false); setSaving(false); if (setup) { alert("오픈채팅방을 등록했어요."); router.push(completionPath); router.refresh(); } }
  async function remove() { if (!confirm("오픈채팅방 링크를 삭제할까요?\\n삭제하면 참가가 확정된 이용자도 링크를 확인할 수 없게 됩니다.")) return; const response = await fetch(`/api/communities/${communityId}/open-chat`, { method: "DELETE" }); if (!response.ok) return setError((await response.json()).message); setRegistered(false); setUrl(""); setEditing(true); }
  if (loading) return <div className="panel">오픈채팅방 정보를 불러오는 중...</div>;
  return <section className={`panel open-chat-manager ${setup ? "open-chat-setup" : ""}`}>
    {setup && <><p className="eyebrow">Community complete</p><h1>커뮤니티 등록이 완료되었어요</h1><p className="muted">참가자들과 원활하게 소통할 수 있도록 오픈채팅방을 등록해주세요.</p><div className="open-chat-guide"><h2>오픈채팅방은 이렇게 설정해주세요</h2><article><b>1</b><div><strong>채팅방 이름</strong><p>등록한 커뮤니티 이름과 동일하게 설정해주세요.</p><span>{communityName}</span></div></article><article><b>2</b><div><strong>프로필</strong><p>오픈채팅 프로필을 사용하고 MODIZA 닉네임과 동일하게 입장하도록 안내해주세요.</p></div></article><article><b>3</b><div><strong>검색 허용 끄기</strong><p>참가가 확정된 이용자만 입장할 수 있도록 검색 허용을 꺼주세요.</p></div></article></div><p className="open-chat-security"><MessageCircle />등록한 오픈채팅방 링크는 참가가 확정된 이용자에게만 공개됩니다.</p></>}
    {!setup && <div className="section-heading"><div><p className="eyebrow">Open chat</p><h3>오픈채팅방</h3></div>{registered ? <span className="tag analysis-done"><CheckCircle2 />등록 완료</span> : <span className="tag analysis-needed">미등록</span>}</div>}
    {!registered && !setup && <><p>아직 오픈채팅방이 등록되지 않았어요.</p><p className="muted">참가자를 확정하기 전에 등록해주세요.</p></>}
    {registered && !editing ? <><p>오픈채팅방이 등록되어 있어요.</p><div className="management-actions"><a className="btn btn-ghost btn-small" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink />링크 확인</a><button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}><Pencil />링크 수정</button><button className="btn btn-ghost btn-small" onClick={() => void remove()}><Trash2 />링크 삭제</button></div></> : <div className="form"><label>오픈채팅방 링크<input className="field" value={url} placeholder="https://open.kakao.com/o/..." onChange={(event) => setUrl(event.target.value)} /><small className="muted">카카오톡 오픈채팅방에서 공유 링크를 복사해 입력해주세요.</small></label>{error && <p className="field-error">{error}</p>}<div className="management-actions"><button type="button" className="btn btn-primary" disabled={saving || !url.trim()} onClick={() => void save()}>{saving ? <><LoaderCircle />저장 중...</> : <><Link2 />오픈채팅방 등록하기</>}</button>{registered && <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>취소</button>}{setup && <button type="button" className="btn btn-ghost" onClick={() => router.push(completionPath)}>{nextPath ? "나중에 등록하고 이용 요청하기" : "나중에 등록하기"}</button>}</div></div>}
  </section>;
}
