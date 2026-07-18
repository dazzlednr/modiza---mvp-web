"use client";

import { Check, FileCheck2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { NegotiationContactMethod } from "@/types/space";

const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function SpaceHostApplicationForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [contactMethod, setContactMethod] = useState<NegotiationContactMethod>("store_phone");
  const [contactValue, setContactValue] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const fail = (text: string, fieldName?: string) => {
      setMessage(text);
      if (fieldName) requestAnimationFrame(() => {
        const field = formElement.elements.namedItem(fieldName);
        if (field instanceof HTMLElement) {
          field.focus();
          field.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });
    };
    const files = form.getAll("evidence").filter((item): item is File => item instanceof File && item.size > 0);
    if (!String(form.get("applicantName") ?? "").trim()) return fail("신청자 이름을 입력해 주세요.", "applicantName");
    if (!String(form.get("spaceName") ?? "").trim()) return fail("운영 중인 공간명을 입력해 주세요.", "spaceName");
    if (!String(form.get("spaceType") ?? "").trim()) return fail("공간 유형을 입력해 주세요.", "spaceType");
    if (!String(form.get("spaceAddress") ?? "").trim()) return fail("공간 주소를 입력해 주세요.", "spaceAddress");
    if (!String(form.get("relationship") ?? "").trim()) return fail("공간과 신청자의 관계를 선택해 주세요.", "relationship");
    if (!contactValue.trim()) return fail("협의에 사용할 연락 정보를 입력해 주세요.", "negotiationContactValue");
    if (contactMethod === "store_phone" && /^(\+?82[-\s]?)?0?1[016789][-\s]?/i.test(contactValue.replace(/[()]/g, ""))) {
      return fail("개인 휴대전화번호가 아닌 매장 대표 전화번호를 입력해 주세요.", "negotiationContactValue");
    }
    if (!files.length) return fail("공간 운영 권한을 확인할 수 있는 증빙자료를 1개 이상 첨부해 주세요.", "evidence");
    if (files.length > MAX_FILES) return fail("증빙자료는 최대 3개까지 첨부할 수 있어요.", "evidence");
    if (files.some((file) => !allowedTypes.has(file.type))) return fail("PDF, JPG, JPEG, PNG 형식의 파일만 첨부할 수 있어요.", "evidence");
    if (files.some((file) => file.size > MAX_FILE_SIZE)) return fail("각 파일은 10MB 이하로 첨부해 주세요.", "evidence");

    setLoading(true);
    setMessage("");
    const response = await fetch("/api/space-host-applications", { method: "POST", body: form });
    const result = await response.json();
    if (!response.ok) {
      setMessage(result.message || "신청하지 못했어요.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return <form className="panel form" noValidate onSubmit={submit}>
    <div className="grid form-grid">
      <label>신청자 이름<input className="field" name="applicantName" required maxLength={60} /></label>
      <label>공간명<input className="field" name="spaceName" required maxLength={100} /></label>
      <label>공간 유형<input className="field" name="spaceType" required placeholder="카페, 스튜디오, 회의실 등" /></label>
      <label className="profile-wide">공간 주소<input className="field" name="spaceAddress" required placeholder="운영자 인증 후 공간 등록 시 다시 확인하고 수정할 수 있어요." /></label>
      <label>공간과 신청자의 관계<select className="field" name="relationship" required defaultValue=""><option value="" disabled>선택해 주세요</option><option value="representative">대표자</option><option value="business_owner">사업자</option><option value="space_owner">공간 소유자</option><option value="tenant">임차인</option><option value="employee">직원 또는 담당자</option><option value="delegated_operator">위임받은 운영자</option><option value="other">기타</option></select></label>
    </div>

    <fieldset className="contact-fieldset">
      <legend>협의 연락 방법 <span className="field-required">필수</span></legend>
      <p className="muted">공간 이용 문의와 일정 협의에 사용할 업무용 연락 방법을 등록해주세요. 이 정보는 공간 상세의 이용 정보에 표시됩니다.</p>
      <div className="grid form-grid">
        <label>연락 방법<select className="field" name="negotiationContactMethod" value={contactMethod} onChange={(event) => setContactMethod(event.target.value as NegotiationContactMethod)}>
          <option value="store_phone">매장 전화번호</option><option value="kakao_open_chat">카카오톡 오픈채팅</option><option value="kakao_channel">카카오톡 채널</option><option value="instagram">인스타그램</option><option value="other">기타 연락 방법</option>
        </select></label>
        <label>{contactMethod === "store_phone" ? "매장 전화번호" : contactMethod === "kakao_open_chat" ? "오픈채팅 링크" : contactMethod === "kakao_channel" ? "카카오톡 채널 링크" : contactMethod === "instagram" ? "인스타그램 계정 또는 링크" : "연락 방법 정보"}
          <input className="field" name="negotiationContactValue" required maxLength={300}
            value={contactValue}
            onChange={(event) => setContactValue(event.target.value)}
            inputMode={contactMethod === "store_phone" ? "tel" : "url"}
            placeholder={contactMethod === "store_phone" ? "053-123-4567" : contactMethod === "kakao_open_chat" ? "https://open.kakao.com/..." : contactMethod === "instagram" ? "@modiza_space" : "연락 가능한 업무용 정보를 입력해주세요."} />
          {contactMethod === "store_phone" && <span className="field-help contact-mobile-guidance">개인 휴대전화번호가 아닌 매장 대표 전화번호를 입력해 주세요. 예: 053-123-4567</span>}
        </label>
      </div>
    </fieldset>

    <label>추가 전달 사항 <span className="muted">(선택)</span>
      <textarea className="field" name="message" rows={5} maxLength={1000} />
      <small className="muted">공간 운영자임을 확인하는 데 도움이 되는 내용이 있다면 자유롭게 작성해주세요.</small>
    </label>

    <label>증빙자료 첨부
      <input className="field" name="evidence" type="file" required multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []);
        setFileNames(files.map((file) => file.name));
        if (files.length > MAX_FILES) setMessage("증빙자료는 최대 3개까지 첨부할 수 있어요.");
        else if (files.some((file) => file.size > MAX_FILE_SIZE)) setMessage("각 파일은 10MB 이하로 첨부해 주세요.");
        else setMessage("");
      }} />
    </label>
    {fileNames.length > 0 && <div className="evidence-file-list">{fileNames.map((name, index) => <span className="tag" key={`${name}-${index}`}><FileCheck2 size={14} />{name}</span>)}</div>}
    <div className="evidence-guide">
      <strong>공간을 운영하거나 관리할 권한이 있음을 확인할 수 있는 자료를 1개 이상 첨부해주세요.</strong>
      <p>가능한 자료 예시</p>
      <ul><li>사업자등록증</li><li>임대차계약서</li><li>재직증명서</li><li>명함</li><li>공간 관리자 화면 캡처</li><li>그 밖에 공간 운영 권한을 확인할 수 있는 자료</li></ul>
      <p>PDF, JPG, JPEG, PNG · 파일당 최대 10MB · 최대 3개</p>
    </div>

    <div className="verification-flow" aria-label="공간 운영자 인증 절차">
      {["인증 신청", "관리자 확인", "승인 완료", "공간 등록 가능"].map((step, index) => <div key={step}><span>{index + 1}</span><strong>{step}</strong>{index < 3 && <i>→</i>}</div>)}
    </div>
    <p className="verification-note"><Check size={18} /> 관리자 확인 후 승인되면 공간을 등록할 수 있습니다. 결과는 사이트 내 알림으로 안내됩니다.</p>
    {message && <p className="error-summary" role="alert">{message}</p>}
    <button className="btn btn-primary" disabled={loading}>{loading ? "신청서를 제출하고 있어요…" : "공간 운영자 인증 신청"}</button>
  </form>;
}
