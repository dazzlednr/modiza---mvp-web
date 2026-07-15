# MODIZA MVP

Part 4-3의 사용자별 소유권, RLS, 실행 순서는 [Part 4-3 문서](docs/part-4-3-ownership.md)를 참고한다.

## 공간 추천 엔진

운영지원의 공간 추천은 `POST /api/space-recommendations`에서 수행한다. 브라우저는 조건만 전달하며, 서버가 Supabase에서 `status = active`인 공간을 조회한 뒤 `src/services/space-recommendation.ts`의 순수 규칙 함수로 점수를 계산한다. 따라서 같은 공간 데이터와 같은 조건은 항상 같은 추천 순서가 된다.

### 점수와 탈락 조건

- 인원 25점
- 필수 시설 20점
- 적합한 활동 20점
- 지역 15점
- 분위기 10점
- 가격 5점
- 이용 요일 5점

최대 인원이 부족하거나, 필수 시설이 하나라도 없거나, 선택한 요일에 이용할 수 없는 공간은 즉시 제외한다. 비활성 공간은 조회 단계에서 제외한다. 남은 공간은 점수 내림차순, 시간당 가격 오름차순, 최근 등록순으로 정렬하고 Top 5만 반환한다. 개발 환경에서는 API 응답에 탈락 및 순위 제외 사유도 포함한다.

### OpenAI의 역할

OpenAI는 공간을 고르거나 점수를 변경하지 않는다. 규칙 엔진이 확정한 Top 5와 사용자 조건만 전달받아 한국어 추천 이유를 작성한다. 모델은 `src/config/openai.ts` 한 곳에서 관리하며 API 키는 서버의 `process.env.OPENAI_API_KEY`만 사용한다. 설명 생성이 실패해도 규칙 기반 추천 결과는 그대로 반환된다.

### 캐싱

정렬된 추천 조건과 추천 공간의 점수·근거·가격을 SHA-256으로 해시한다. `space_recommendation_reasons` 테이블에서 `condition_hash + space_id` 조합으로 기존 설명을 조회하고, 없는 공간에 대해서만 OpenAI를 호출한다. 최근 입력 조건은 브라우저 `localStorage`에 저장해 다음 방문 때 복원한다.

### 필요한 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
```

추천 이유 캐시와 추천 공간 기반 커뮤니티 생성을 사용하려면 `supabase/migrations/202607130004_space_recommendation_reasons.sql`을 Supabase SQL Editor에서 실행한다.

## 커뮤니티 운영과 참여 신청

커뮤니티 생성·수정·상태 변경·삭제와 비회원 신청은 모두 Next.js Route Handler에서 service role 클라이언트를 사용한다. 브라우저는 `communities`와 `community_applications`에 직접 쓰지 않는다. 공개 사용자는 `published` 커뮤니티만 읽을 수 있고 신청자의 연락처·자기소개·답변은 공개 조회할 수 없다.

대표 이미지는 공개 `community-images` 버킷의 `communities/{communityId}/{uuid}.{ext}` 경로에 저장한다. JPG, PNG, WebP만 허용하고 서버에서 5MB 제한을 다시 검사한다.

신청 승인 상태는 `change_application_status` PostgreSQL 함수에서 신청과 커뮤니티 행을 잠근 뒤 변경한다. 승인 전환 때 정원을 재검증하고 `current_members`를 증가시키며, 승인 취소 때 0 미만으로 내려가지 않도록 감소시킨다. 동일 연락처의 `pending` 또는 `approved` 신청은 서버에서 차단하며 `rejected` 신청은 재신청할 수 있다.

현재는 인증 전 데모 단계이므로 하나의 데모 운영자가 모든 커뮤니티를 관리한다. Supabase Auth 도입 시 `operator_id`를 실제 사용자 ID와 연결하고, service role 기반 데모 관리 Route를 사용자 세션 검증 및 소유권 기반 RLS 정책으로 교체해야 한다.

Part 4를 사용하려면 `supabase/migrations/202607130005_community_operations.sql`을 SQL Editor에서 실행해야 한다.

## Part 4-1 회원 인증

이메일과 비밀번호 인증은 Supabase Auth와 `@supabase/ssr`을 사용한다. 브라우저와 서버가 쿠키 기반 세션을 공유하며 `src/proxy.ts`가 만료된 토큰을 갱신한다. 회원가입 시 닉네임을 Auth user metadata로 전달하고, Database Trigger가 `auth.users`와 같은 ID의 `public.profiles` 행을 자동 생성한다.

`profiles`는 `id`, `email`, `nickname`, `profile_image`, `roles`, `created_at`, `updated_at`으로 구성한다. 이번 단계의 `roles`는 항상 `['member']`이며, 사용자는 RLS를 통해 자신의 프로필만 조회하고 닉네임과 프로필 사진만 수정할 수 있다. Service Role Key는 기존처럼 서버 전용 admin client에서만 사용한다.

인증 기능을 사용하기 전에 `supabase/migrations/202607140002_profiles_auth.sql`을 Supabase SQL Editor에서 실행한다. Authentication의 Email provider를 활성화하고 Site URL을 로컬에서는 `http://127.0.0.1:3000`, 배포 환경에서는 실제 서비스 주소로 설정한다. Redirect URLs에는 다음 주소를 등록한다.

- `http://127.0.0.1:3000/auth/callback`
- 배포 주소의 `/auth/callback`

## Part 4-2 복수 역할

- 모든 가입자는 `member`를 유지하며 같은 계정에 `community_host`, `space_host`를 추가할 수 있다.
- 일반 사용자가 직접 활성화할 수 있는 역할은 `community_host`, `space_host`뿐이다. `admin`은 역할 추가 API와 DB RPC에서 모두 거절한다.
- 역할 활성화는 `POST /api/profile/roles` → 인증 쿠키가 적용된 Supabase client → `add_current_user_role` RPC 순서로 처리한다. Service Role Key는 브라우저에 전달하지 않는다.
- `normalize_profile_roles`가 `member` 유지, 허용 역할 필터링, 중복 제거와 정렬을 보장한다.
- 비로그인 사용자는 내부 `next` 경로와 함께 로그인으로 이동하고, 로그인 후 역할 시작 화면을 거쳐 원래 쿼리스트링까지 복귀한다.
- 역할별 페이지는 Server Component layout에서 `requireRole` 또는 `requireAnyRole`로 먼저 보호한다.

필수 SQL 실행 순서:

1. `supabase/migrations/202607140002_profiles_auth.sql`
2. `supabase/migrations/202607140003_profiles_multiple_roles.sql`

Part 4-2에서는 기존 데모 커뮤니티와 공간의 소유권을 현재 Auth 사용자에게 이전하지 않는다. 기존 대시보드 조회도 데모 전체 데이터를 유지하며, `owner_id` 연결과 communities/spaces/applications/schedules/checklists의 사용자별 RLS는 Part 4-3에서 적용한다.
