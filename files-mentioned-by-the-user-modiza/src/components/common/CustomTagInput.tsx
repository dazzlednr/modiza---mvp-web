"use client";

import { Plus, X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

type CustomTagInputProps = {
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  placeholder?: string;
  max?: number;
};

function normalizeTag(value: string) {
  return value.trim().replace(/^#+/, "").trim();
}

export function CustomTagInput({ values, onChange, addLabel, placeholder = "태그 입력 후 Enter", max = 3 }: CustomTagInputProps) {
  const [open, setOpen] = useState(values.length > 0);
  const [input, setInput] = useState("");

  function addTags(source: string) {
    const next = [...values];
    for (const part of source.split(",")) {
      const tag = normalizeTag(part);
      if (!tag || next.length >= max) continue;
      if (next.some((item) => item.toLocaleLowerCase("ko-KR") === tag.toLocaleLowerCase("ko-KR"))) continue;
      next.push(tag);
    }
    if (next.length !== values.length) onChange(next);
    setInput("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") return;
    event.preventDefault();
    addTags(input);
  }

  return <div className="custom-tag-control">
    <div className="category-row custom-tag-list">
      {values.map((tag) => <button type="button" className="category active custom-tag" key={tag} onClick={() => onChange(values.filter((item) => item !== tag))} aria-label={`${tag} 태그 삭제`}>#{tag}<X size={14} /></button>)}
      {values.length < max && <button type="button" className="category custom-tag-add" onClick={() => setOpen(true)}><Plus size={15} />{addLabel}</button>}
    </div>
    {open && values.length < max && <div className="custom-tag-entry"><input className="field" value={input} maxLength={40} placeholder={placeholder} onChange={(event) => { const next = event.target.value; if (next.includes(",")) addTags(next); else setInput(next); }} onKeyDown={handleKeyDown} onBlur={() => { if (input.trim()) addTags(input); }} autoFocus /><span>{values.length}/{max} · 쉼표 또는 Enter로 추가</span></div>}
  </div>;
}
