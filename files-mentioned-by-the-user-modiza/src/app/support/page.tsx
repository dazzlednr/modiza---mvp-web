import Link from "next/link";
import { CalendarDays, CheckCircle2, MapPin, Megaphone, MessagesSquare, Users } from "lucide-react";

const features = [
  [CheckCircle2, "운영 체크리스트", "놓치기 쉬운 준비를 순서대로 확인해요."],
  [CalendarDays, "일정 관리", "모임 일정을 한눈에 정리해요."],
  [Users, "참가 신청 관리", "신청부터 명단까지 간편하게 관리해요."],
  [MessagesSquare, "공지 작성", "중요한 소식을 빠르게 전해요."],
  [Megaphone, "모집 글 지원", "매력적인 모집 문구를 함께 만들어요."],
  [MapPin, "공간 추천", "인원·목적·예산에 맞는 등록 공간을 찾아요."],
] as const;

export default function Page() {
  return <>
    <section className="hero"><div className="container"><p className="eyebrow">Operator support</p><h1 className="section-title">좋은 모임에만 집중하세요.<br />운영의 번거로움은 모디자가 덜어드릴게요.</h1><p className="muted">커뮤니티 운영 전반을 돕는 실용적인 도구를 한곳에 모았습니다.</p></div></section>
    <section className="section"><div className="container">
      <div className="grid cards">{features.map(([Icon, title, description]) => <div className="panel" key={title}><Icon /><h3>{title}</h3><p className="muted">{description}</p></div>)}</div>
      <div className="banner" style={{ marginTop: 56 }}><div><h2>운영을 가볍게 시작해볼까요?</h2><p>별도 가입 없이 같은 계정으로 바로 시작할 수 있어요.</p></div><Link className="btn btn-accent" href="/role/start?role=community_host&redirect=/dashboard">운영지원 시작하기</Link></div>
    </div></section>
  </>;
}
