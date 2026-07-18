"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState,type FormEvent } from "react";
import { communityCategories } from "@/constants/taxonomy";
import type { CommunityHostProfile } from "@/types/community";

const styles=["초보 환영","혼자 참여 환영","편안한 분위기","적극적인 소통","정기 운영","자유로운 참여","소규모 선호","친목 중심","자기계발 중심"];
type MemberIdentity={nickname:string;profileImage:string|null};

export function CommunityHostProfileForm({initial,member,redirectTo,editing=false}:{initial?:CommunityHostProfile|null;member:MemberIdentity;redirectTo:string;editing?:boolean}){
 const router=useRouter(); const [values,setValues]=useState({headline:initial?.headline??"",introduction:initial?.introduction??"",activityRegion:initial?.activityRegion??"",interestCategories:initial?.interestCategories??[] as string[],operatingStyles:initial?.operatingStyles??[] as string[]}); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
 const set=(key:string,value:unknown)=>setValues(current=>({...current,[key]:value})); const toggle=(key:"interestCategories"|"operatingStyles",value:string)=>set(key,values[key].includes(value)?values[key].filter(item=>item!==value):[...values[key],value]);
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();
  const formElement=event.currentTarget;
  const fail=(message:string,fieldName:string)=>{setError(message);requestAnimationFrame(()=>{const field=formElement.elements.namedItem(fieldName);if(field instanceof HTMLElement){field.focus();field.scrollIntoView({behavior:"smooth",block:"center"});}});};
  if(values.headline.trim().length<2){fail("한 줄 소개는 2자 이상 입력해 주세요.","headline");return;}
  if(values.introduction.trim().length<10){fail("운영자 소개는 10자 이상 입력해 주세요.","introduction");return;}
  setSaving(true);setError("");
  try{const form=new FormData();Object.entries(values).forEach(([key,value])=>form.set(key,Array.isArray(value)?JSON.stringify(value):String(value)));const response=await fetch("/api/community-host-profile",{method:editing?"PUT":"POST",body:form});const result=await response.json();if(!response.ok)throw new Error(result.message);router.push(redirectTo);router.refresh();}catch(caught){setError(caught instanceof Error?caught.message:"저장하지 못했어요.");}finally{setSaving(false);}
 }
 return <form className="form panel" noValidate onSubmit={submit}><div className="community-host-card"><div className="community-host-avatar">{member.profileImage?<Image src={member.profileImage} alt={member.nickname} fill/>:<UserRound/>}</div><div><p className="eyebrow">Member profile</p><h3>{member.nickname}</h3><p className="muted">닉네임과 프로필 사진은 회원 프로필과 동일하게 사용됩니다.</p></div></div><label>한 줄 소개 <span className="field-required">필수</span><input className="field" name="headline" required minLength={2} maxLength={120} value={values.headline} onChange={e=>set("headline",e.target.value)} placeholder="예: 혼자 참여해도 편안한 독서모임을 운영합니다." /><span className="field-help">2자 이상 입력해 주세요. ({values.headline.trim().length}/120)</span></label><label>운영자 소개 <span className="field-required">필수</span><textarea className="field" name="introduction" required minLength={10} rows={6} maxLength={1000} value={values.introduction} onChange={e=>set("introduction",e.target.value)} placeholder={"안녕하세요.\n처음 참여하시는 분도 부담 없이 이야기할 수 있는 분위기를 중요하게 생각합니다."} /><span className="field-help">10자 이상 입력해 주세요. ({values.introduction.trim().length}/1000)</span></label><label>활동 지역 <span className="muted">(선택)</span><input className="field" maxLength={80} value={values.activityRegion} onChange={e=>set("activityRegion",e.target.value)} placeholder="예: 대구 중구, 동성로" /></label><fieldset><legend>관심 분야 <span className="muted">(선택)</span></legend><div className="category-row community-host-option-row">{communityCategories.map(item=><button type="button" className={`category ${values.interestCategories.includes(item)?"active":""}`} key={item} onClick={()=>toggle("interestCategories",item)}>{item}</button>)}</div></fieldset><fieldset><legend>운영 스타일 <span className="muted">(선택)</span></legend><div className="category-row community-host-option-row">{styles.map(item=><button type="button" className={`category ${values.operatingStyles.includes(item)?"active":""}`} key={item} onClick={()=>toggle("operatingStyles",item)}>{item}</button>)}</div></fieldset>{error&&<p className="error-summary" role="alert">{error}</p>}<button className="btn btn-primary" disabled={saving}>{saving?"저장하고 있어요...":editing?"운영자 정보 저장":"운영 시작하기"}</button></form>;
}
