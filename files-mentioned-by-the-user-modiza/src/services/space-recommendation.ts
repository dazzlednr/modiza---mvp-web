import type { Space } from "@/types/space";
import type {
  RecommendationExclusion,
  SpaceRecommendationInput,
  SpaceRecommendationResult,
} from "@/types/space-recommendation";

const dayNames = ["일", "월", "화", "수", "목", "금", "토"];

const activityAliases: Record<string, string[]> = {
  독서: ["독서", "북토크"],
  영화: ["영화", "상영"],
  글쓰기: ["글쓰기", "작문"],
  네트워킹: ["네트워킹", "교류"],
  스터디: ["스터디", "공부"],
  공연: ["공연", "연습", "음악"],
  "원데이 클래스": ["원데이클래스", "워크숍", "공방", "클래스"],
  사진: ["사진", "촬영", "스튜디오"],
  운동: ["운동", "요가", "댄스"],
  기타: [],
};

const normalize = (value: string) =>
  value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");

function includesAny(values: string[], targets: string[]) {
  const normalized = values.map(normalize);
  return targets.some((target) =>
    normalized.some(
      (value) => value.includes(normalize(target)) || normalize(target).includes(value),
    ),
  );
}

function availableFacilities(space: Space) {
  return space.parkingAvailable
    ? [...space.facilities, "주차"]
    : space.facilities;
}

function weekday(date: string) {
  return dayNames[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

export function recommendSpaces(
  spaces: Space[],
  input: SpaceRecommendationInput,
): {
  results: SpaceRecommendationResult[];
  exclusions: RecommendationExclusion[];
} {
  const results: SpaceRecommendationResult[] = [];
  const exclusions: RecommendationExclusion[] = [];
  const selectedDay = weekday(input.date);

  for (const space of spaces) {
    const reasons: string[] = [];
    const facilities = availableFacilities(space);
    const missingFacilities = input.facilities.filter(
      (required) => !includesAny(facilities, [required]),
    );

    if (space.status !== "active") reasons.push("운영 중인 공간이 아님");
    if (space.maxCapacity < input.capacity) reasons.push("최대 인원 부족");
    if (missingFacilities.length) {
      reasons.push(`필수 시설 없음: ${missingFacilities.join(", ")}`);
    }
    if (!space.availableDays.includes(selectedDay)) {
      reasons.push(`${selectedDay}요일 이용 불가`);
    }

    if (reasons.length) {
      exclusions.push({ spaceId: space.id, spaceName: space.name, reasons });
      continue;
    }

    const suitableCapacity = space.suitableCapacity ?? space.maxCapacity;
    const capacityScore =
      input.capacity <= suitableCapacity
        ? 25
        : Math.max(
            15,
            Math.round(25 * (space.maxCapacity - input.capacity + 1) /
              Math.max(1, space.maxCapacity - suitableCapacity + 1)),
          );
    const facilityScore = 20;
    const activityScore = includesAny(
      space.suitableActivities,
      activityAliases[input.meetingType],
    )
      ? 20
      : 0;
    const regionScore = space.detailedRegion === input.region ? 15 : 0;
    const moodMatches = input.moods.filter((mood) =>
      includesAny(space.moods, [mood]),
    );
    const moodScore = input.moods.length
      ? Math.round((moodMatches.length / input.moods.length) * 10)
      : 10;
    const priceScore = space.pricePerHour <= input.budget ? 5 : 0;
    const weekdayScore = 5;
    const scoreBreakdown = {
      capacity: capacityScore,
      facilities: facilityScore,
      activity: activityScore,
      region: regionScore,
      mood: moodScore,
      price: priceScore,
      weekday: weekdayScore,
    };
    const score = Object.values(scoreBreakdown).reduce(
      (total, value) => total + value,
      0,
    );
    const evidence = [
      ...(regionScore ? ["지역 일치"] : []),
      ...moodMatches.map((mood) => `${mood} 분위기 일치`),
      ...input.facilities.map((facility) => `${facility} 있음`),
      ...(priceScore ? ["예산 충족"] : ["예산 초과"]),
      "적정 인원",
      `${selectedDay}요일 이용 가능`,
      ...(activityScore ? [`${input.meetingType} 활동 적합`] : []),
    ];

    results.push({
      id: space.id,
      slug: space.slug,
      name: space.name,
      thumbnailUrl: space.thumbnailUrl ?? space.images[0]?.publicUrl,
      region: `${space.mainRegion} · ${space.detailedRegion === "기타" ? space.customRegion || "기타" : space.detailedRegion}`,
      pricePerHour: space.pricePerHour,
      maxCapacity: space.maxCapacity,
      facilities,
      moods: space.moods,
      score,
      scoreBreakdown,
      evidence,
    });
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.pricePerHour !== b.pricePerHour) return a.pricePerHour - b.pricePerHour;
    const aSpace = spaces.find((space) => space.id === a.id);
    const bSpace = spaces.find((space) => space.id === b.id);
    return (bSpace?.createdAt ?? "").localeCompare(aSpace?.createdAt ?? "");
  });

  const top = results.slice(0, 5);
  for (const result of results.slice(5)) {
    exclusions.push({
      spaceId: result.id,
      spaceName: result.name,
      reasons: [
        result.pricePerHour > input.budget ? "예산 초과 및 점수 순위 밖" : "점수 순위 밖",
      ],
    });
  }

  return { results: top, exclusions };
}
