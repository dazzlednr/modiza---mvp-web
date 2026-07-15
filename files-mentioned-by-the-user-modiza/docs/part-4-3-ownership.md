# Part 4-3 사용자별 소유권과 RLS

일반 CRUD는 로그인 쿠키가 적용된 Supabase 클라이언트를 사용하며, RLS가 `auth.uid()`와 역할을 함께 검증한다. 클라이언트가 전달한 사용자 ID나 소유자 ID는 신뢰하지 않는다. Service Role은 사용자 CRUD와 분리된 서버 내부 캐시 작업에만 남겨 두었다.

- `communities.owner_id = auth.uid()`: `community_host`만 생성하고 소유자만 비공개 데이터 조회·수정·삭제가 가능하다.
- `spaces.owner_id = auth.uid()`: `space_host`만 생성하고 소유자만 수정·삭제·AI 분석을 관리한다.
- `community_applications.applicant_user_id = auth.uid()`: 로그인 회원만 신청하며 본인 신청만 조회·취소한다.
- 일정과 체크리스트는 `community_id`를 통해 커뮤니티 소유권을 검사한다.
- 공개 화면은 `published` 커뮤니티와 `active` 공간만 조회한다. 기존 Seed 행은 `owner_id = null`인 공개 샘플로 유지된다.
- 신청 승인·거절은 `change_application_status_as_owner` RPC가 신청과 커뮤니티 행을 잠그고 정원 검사, 상태 변경, 현재 인원 변경을 한 트랜잭션에서 처리한다.
- 신규 Storage 경로는 `community-images/{ownerId}/{communityId}/...`, `space-images/{ownerId}/{spaceId}/...`이며 폴더의 ownerId와 `auth.uid()`를 검증한다.

## Supabase SQL Editor 실행 순서

1. `supabase/migrations/202607140003_profiles_multiple_roles.sql`
2. `supabase/migrations/202607140004_auth_ownership_rls.sql`

기존 공개 샘플을 실제 계정에 배정해야 할 때만 `supabase/manual/demo_ownership_transfer.example.sql`의 주석을 복사하고 UUID와 slug를 직접 바꿔 실행한다. UUID는 코드에 저장하지 않는다. 대상 계정에는 배정할 데이터에 맞춰 `community_host` 또는 `space_host` 역할이 있어야 한다.
