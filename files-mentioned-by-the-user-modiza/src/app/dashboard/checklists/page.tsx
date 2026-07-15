"use client";
/* eslint-disable react-hooks/set-state-in-effect -- authenticated repository hydration resolves asynchronously. */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckSquare2, Pencil, Plus, Trash2, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  createChecklistGroup,
  createChecklistItem,
  deleteChecklistItem,
  listChecklistGroups,
  updateChecklistItem,
} from "@/repositories/checklistRepository";
import type { Community } from "@/types/community";
import type { ChecklistGroup } from "@/types/operator";

export default function Page() {
  const [groups, setGroups] = useState<ChecklistGroup[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState("");
  const [groupTitle, setGroupTitle] = useState("");
  const [itemTitles, setItemTitles] = useState<Record<string, string>>({});
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setGroups(await listChecklistGroups(createBrowserSupabaseClient()));
  }

  useEffect(() => {
    Promise.all([
      reload(),
      fetch("/api/communities", { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error("COMMUNITIES_LOAD_FAILED");
          return response.json() as Promise<Community[]>;
        })
        .then((items) => {
          setCommunities(items);
          setCommunityId(items[0]?.id ?? "");
        }),
    ]).catch(() => setError("체크리스트를 불러오지 못했어요.")).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => communityId ? groups.filter((group) => group.communityId === communityId) : [],
    [communityId, groups],
  );
  const items = visible.flatMap((group) => group.items);
  const progress = items.length ? Math.round(items.filter((item) => item.completed).length / items.length * 100) : 0;

  async function addGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!communityId) return setError("먼저 커뮤니티를 선택해 주세요.");
    if (!groupTitle.trim()) return setError("체크리스트 이름을 입력해 주세요.");
    setSaving(true);
    setError("");
    try {
      await createChecklistGroup(createBrowserSupabaseClient(), groupTitle.trim(), visible.length, communityId);
      setGroupTitle("");
      setShowCreate(false);
      await reload();
    } catch (createError) {
      console.error("[MODIZA][checklist] create group failed", createError);
      setError("체크리스트를 만들지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  async function addItem(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const title = itemTitles[groupId]?.trim();
    if (!title) return;
    setError("");
    try {
      await createChecklistItem(createBrowserSupabaseClient(), groupId, title);
      setItemTitles((current) => ({ ...current, [groupId]: "" }));
      await reload();
    } catch (createError) {
      console.error("[MODIZA][checklist] create item failed", createError);
      setError("체크리스트 항목을 추가하지 못했어요.");
    }
  }

  async function toggle(id: string, completed: boolean) {
    try { await updateChecklistItem(createBrowserSupabaseClient(), id, { completed }); await reload(); }
    catch { setError("완료 상태를 변경하지 못했어요."); }
  }

  async function edit(id: string, title: string) {
    const next = window.prompt("항목 수정", title);
    if (!next?.trim()) return;
    try { await updateChecklistItem(createBrowserSupabaseClient(), id, { title: next.trim() }); await reload(); }
    catch { setError("항목을 수정하지 못했어요."); }
  }

  async function remove(id: string) {
    if (!window.confirm("이 항목을 삭제할까요?")) return;
    try { await deleteChecklistItem(createBrowserSupabaseClient(), id); await reload(); }
    catch { setError("항목을 삭제하지 못했어요."); }
  }

  if (loading) return <section className="section"><div className="container">체크리스트를 불러오는 중...</div></section>;

  return (
    <section className="section dashboard-shell">
      <div className="container" style={{ maxWidth: 1040 }}>
        <div className="section-heading page-heading">
          <div><p className="eyebrow">Checklist</p><h1 className="section-title">내 커뮤니티 체크리스트</h1><p className="muted">커뮤니티별 준비 업무를 만들고 완료 상태를 관리하세요.</p></div>
          <button type="button" className="btn btn-primary" disabled={!communityId} onClick={() => setShowCreate(true)}><Plus /> 체크리스트 만들기</button>
        </div>

        {error && <p className="error-summary" role="alert">{error}</p>}
        {!communities.length ? (
          <div className="empty"><CheckSquare2 size={40} /><h3>운영 중인 커뮤니티가 없습니다.</h3><p className="muted">커뮤니티를 먼저 만든 후 체크리스트를 추가할 수 있어요.</p></div>
        ) : <>
          <label>커뮤니티<select className="field" value={communityId} onChange={(event) => { setCommunityId(event.target.value); setShowCreate(false); }}><option value="">선택</option>{communities.map((community) => <option value={community.id} key={community.id}>{community.name}</option>)}</select></label>

          {showCreate && <form className="panel checklist-create" onSubmit={addGroup}>
            <div><h2>새 체크리스트 만들기</h2><p className="muted">예: 모임 전 준비, 장소 준비, 홍보 및 모집</p></div>
            <input className="field" autoFocus maxLength={80} placeholder="체크리스트 이름" value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
            <button className="btn btn-primary" disabled={saving}>{saving ? "만드는 중..." : "만들기"}</button>
            <button type="button" className="btn btn-ghost" aria-label="취소" onClick={() => { setShowCreate(false); setGroupTitle(""); }}><X /></button>
          </form>}

          <div className="panel checklist-progress"><div><b>진행률 {progress}%</b><span className="muted">{items.filter((item) => item.completed).length}/{items.length}개 완료</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>

          {visible.length ? <div className="checklist-grid">{visible.map((group) => <section className="panel checklist-group" key={group.id}>
            <div className="section-heading"><h2>{group.title}</h2><span className="tag">{group.items.filter((item) => item.completed).length}/{group.items.length}</span></div>
            <div className="checklist-items">{group.items.map((item) => <div className="checklist-item" key={item.id}>
              <input aria-label={`${item.title} 완료`} type="checkbox" checked={item.completed} onChange={() => void toggle(item.id, !item.completed)} />
              <span className={item.completed ? "completed" : ""}>{item.title}</span>
              <button type="button" aria-label="수정" onClick={() => void edit(item.id, item.title)}><Pencil size={16} /></button>
              <button type="button" aria-label="삭제" onClick={() => void remove(item.id)}><Trash2 size={16} /></button>
            </div>)}</div>
            <form className="checklist-item-form" onSubmit={(event) => void addItem(event, group.id)}><input className="field" placeholder="새 할 일 입력" value={itemTitles[group.id] ?? ""} onChange={(event) => setItemTitles((current) => ({ ...current, [group.id]: event.target.value }))} /><button className="btn btn-primary"><Plus /> 추가</button></form>
          </section>)}</div> : !showCreate && <div className="empty checklist-empty"><CheckSquare2 size={42} /><h3>이 커뮤니티의 체크리스트가 없어요.</h3><p className="muted">첫 체크리스트를 만들고 준비할 일을 하나씩 관리해 보세요.</p><button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}><Plus /> 첫 체크리스트 만들기</button></div>}
        </>}
      </div>
    </section>
  );
}
