# MODIZA 공간 Storage 설정

1. SQL Editor에서 `supabase/migrations/202607130002_spaces_storage.sql`을 실행합니다. 이 Migration은 `spaces`, `space_images`, `demo_space_operators`와 public `space-images` bucket(5MB, JPEG/PNG/WebP)을 생성합니다.
2. `supabase/seed-spaces.sql`을 실행하면 데모 공간 4개가 추가됩니다.
3. 브라우저 anon 사용자는 active 공간과 그 이미지만 읽을 수 있습니다. 생성·수정·삭제·업로드는 `/api/spaces` Route Handler가 서버 전용 `SUPABASE_SERVICE_ROLE_KEY`로 처리합니다.
4. 업로드 경로는 `spaces/{spaceId}/{uuid}.{extension}`이며 공간당 8장, 파일당 5MB로 제한됩니다.
5. 임시 저장은 `draft`, 최종 등록은 `active`, 비공개는 `inactive`입니다.
6. Vercel에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`를 설정합니다. Service Role Key는 절대 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.
7. Part 2-2 사진 분석은 이미지 업로드 완료 후 `src/app/api/spaces/[id]/images/route.ts`와 `src/repositories/spaceRepository.ts` 사이에 별도 분석 service를 연결합니다. 이번 Part에서는 OpenAI를 호출하지 않습니다.

## OpenAI Vision 분석

- `OPENAI_API_KEY`는 서버 Route Handler에서만 `process.env.OPENAI_API_KEY`로 읽습니다.
- `src/app/api/spaces/[id]/analysis/route.ts`가 Responses API에 Storage public URL을 이미지 입력으로 전달합니다.
- 모델은 `src/config/openai.ts`의 `gpt-5.4-mini` 한 곳에서 관리합니다.
- 응답은 Structured Outputs와 Zod schema로 검증한 뒤 `space_analysis.analysis_json`에 저장합니다.
- 이미지 Storage path 목록의 SHA-256 signature가 같으면 기존 결과를 반환하며, 명시적인 재분석 때만 새 API 요청을 보냅니다.
- 운영자가 수정한 결과를 저장하면 `spaces.space_type`, `moods`, `facilities`, `suitable_activities`, `description`에도 반영됩니다.
- `supabase/migrations/202607130003_space_analysis.sql`을 SQL Editor에서 실행해야 합니다.

저장 순서는 draft 생성 → Storage 업로드 → `space_images` 생성 → 대표 이미지 반영 → active 전환입니다. 중간 실패 시 업로드 파일과 draft 레코드를 정리합니다.
