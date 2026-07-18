"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ImagePlus,
  Lightbulb,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { RegionFields } from "@/components/common/RegionFields";
import { CustomTagInput } from "@/components/common/CustomTagInput";
import { RoadAddressSearch } from "@/components/common/RoadAddressSearch";
import { PRIMARY_REGION } from "@/constants/taxonomy";
import type { StructuredSpaceAddress } from "@/lib/address/kakaoPostcode";
import { useStepFormScroll } from "@/hooks/useStepFormScroll";
import type {
  CommunityUseMode,
  NegotiationContactMethod,
  Space,
  SpaceCommunityAvailability,
  SpaceFormValues,
  SpaceOperatingHour,
  SpaceRelationshipType,
} from "@/types/space";

const DAYS = [
  { value: 1, label: "월" }, { value: 2, label: "화" }, { value: 3, label: "수" },
  { value: 4, label: "목" }, { value: 5, label: "금" }, { value: 6, label: "토" },
  { value: 0, label: "일" },
] as const;
const DAY_BY_VALUE = Object.fromEntries(DAYS.map((day) => [day.value, day.label])) as Record<number, string>;
const VALUE_BY_DAY = Object.fromEntries(DAYS.map((day) => [day.label, day.value])) as Record<string, number>;
const CONTACT_METHODS: { value: NegotiationContactMethod; label: string }[] = [
  { value: "store_phone", label: "매장 전화번호" },
  { value: "kakao_open_chat", label: "카카오톡 오픈채팅" },
  { value: "kakao_channel", label: "카카오톡 채널" },
  { value: "instagram", label: "인스타그램" },
  { value: "other", label: "기타" },
];
const CONTACT_PLACEHOLDERS: Record<NegotiationContactMethod, string> = {
  store_phone: "053-123-4567",
  kakao_open_chat: "https://open.kakao.com/...",
  kakao_channel: "https://pf.kakao.com/...",
  instagram: "@modiza_space",
  other: "협의에 사용할 연락 방법과 정보를 입력해주세요.",
};
const steps = ["기본 정보", "운영 및 이용 방식", "조건 및 시설", "사진·규칙·인증·제출"];
const options = {
  facilities: ["빔프로젝터", "스크린", "스피커", "마이크", "화이트보드", "긴 테이블", "개별 테이블", "의자", "와이파이", "콘센트", "주방", "화장실", "냉난방", "주차"],
  moods: ["조용한", "따뜻한", "아늑한", "감각적인", "밝은", "자연광이 좋은", "전문적인", "자유로운", "활동적인", "독특한"],
  suitableActivities: ["독서모임", "영화모임", "글쓰기", "네트워킹", "스터디", "워크숍", "촬영", "전시", "공연", "원데이 클래스", "보드게임", "소규모 행사"],
} as const;

const emptyHours = (): SpaceOperatingHour[] => DAYS.map(({ value }) => ({
  dayOfWeek: value,
  isOpen: value >= 1 && value <= 5,
  startTime: value >= 1 && value <= 5 ? "09:00" : null,
  endTime: value >= 1 && value <= 5 ? "22:00" : null,
  hasBreak: false,
}));
const emptyAvailability = (): SpaceCommunityAvailability[] => DAYS.filter(({ value }) => value >= 1 && value <= 5).map(({ value }) => ({
  dayOfWeek: value,
  startTime: "10:00",
  endTime: "20:00",
}));
const availabilityFromOperatingHours = (hours: SpaceOperatingHour[]): SpaceCommunityAvailability[] =>
  hours
    .filter((hour) => hour.isOpen && hour.startTime && hour.endTime)
    .map((hour) => ({
      dayOfWeek: hour.dayOfWeek,
      startTime: hour.startTime,
      endTime: hour.endTime,
    }));

function blankValues(): SpaceFormValues {
  return {
    name: "", spaceType: "", shortDescription: "", description: "",
    mainRegion: PRIMARY_REGION, detailedRegion: "", customRegion: "", address: "", addressDetail: "",
    postalCode: "", roadAddress: "", jibunAddress: "", buildingName: "",
    addressSido: "", addressSigungu: "", addressDong: "",
    pricePerHour: 0, minimumHours: 1, minCapacity: 1, suitableCapacity: undefined, maxCapacity: 1,
    availableDays: ["월", "화", "수", "목", "금"], availableStartTime: "09:00", availableEndTime: "22:00",
    usesDaySpecificHours: false, operatingHours: emptyHours(),
    communityUseMode: "request_consultation", communityAvailability: emptyAvailability(),
    communityAvailabilityAutoSync: true,
    communityRecurrenceType: "weekly", communityAvailabilityStartDate: "", communityAvailabilityEndDate: "",
    communitySpecificDates: [], minimumOrderOrFee: "", additionalUseConditions: "",
    useHostContact: true, preferredContactMethod: null, privateContact: "", usageRules: "", difficultActivities: [],
    regularUseAvailable: false, facilities: [], moods: [], suitableActivities: [],
    noiseLevel: "moderate", foodAllowed: false, alcoholAllowed: false,
    furnitureMovable: false, parkingAvailable: false, status: "draft",
  };
}

const minutes = (value?: string | null) => {
  if (!value) return null;
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
};
const normalizedEnd = (start: number, end: number) => end <= start ? end + 1440 : end;
function validRange(start?: string | null, end?: string | null) {
  const from = minutes(start);
  const to = minutes(end);
  return from !== null && to !== null && from !== to;
}
function validBreak(hour: SpaceOperatingHour) {
  if (!hour.hasBreak) return true;
  const open = minutes(hour.startTime);
  const closeRaw = minutes(hour.endTime);
  const breakStartRaw = minutes(hour.breakStartTime);
  const breakEndRaw = minutes(hour.breakEndTime);
  if ([open, closeRaw, breakStartRaw, breakEndRaw].some((value) => value === null)) return false;
  const close = normalizedEnd(open!, closeRaw!);
  let breakStart = breakStartRaw!;
  let breakEnd = normalizedEnd(breakStart, breakEndRaw!);
  if (breakStart < open!) { breakStart += 1440; breakEnd += 1440; }
  return breakStart >= open! && breakEnd <= close && breakStart < breakEnd;
}

function availabilityFitsOperatingHour(availability: SpaceCommunityAvailability, hour?: SpaceOperatingHour) {
  if (!hour?.isOpen || !validRange(availability.startTime, availability.endTime)) return false;
  const open = minutes(hour.startTime);
  const closeRaw = minutes(hour.endTime);
  const startRaw = minutes(availability.startTime);
  const endRaw = minutes(availability.endTime);
  if ([open, closeRaw, startRaw, endRaw].some((value) => value === null)) return false;
  const close = normalizedEnd(open!, closeRaw!);
  let start = startRaw!;
  if (start < open!) start += 1440;
  const end = normalizedEnd(start, endRaw!);
  if (start < open! || end > close) return false;
  if (!hour.hasBreak) return true;
  let breakStart = minutes(hour.breakStartTime);
  const breakEndRaw = minutes(hour.breakEndTime);
  if (breakStart === null || breakEndRaw === null) return false;
  if (breakStart < open!) breakStart += 1440;
  const breakEnd = normalizedEnd(breakStart, breakEndRaw);
  return end <= breakStart || start >= breakEnd;
}

function FieldTip({ children }: { children: ReactNode }) {
  return <details className="field-tip"><summary><Lightbulb size={15} />작성 팁</summary><p>{children}</p></details>;
}

export function SpaceForm({
  space,
  suggested,
  suggestedVersion = 0,
  initialFiles = [],
  controlledFiles,
  hidePhotoSection = false,
  assisted = false,
}: {
  space?: Space;
  suggested?: Partial<SpaceFormValues>;
  suggestedVersion?: number;
  initialFiles?: File[];
  controlledFiles?: File[];
  hidePhotoSection?: boolean;
  assisted?: boolean;
}) {
  const router = useRouter();
  const initial = useMemo(() => ({
    ...blankValues(),
    ...(space ?? suggested),
    customRegion: space?.customRegion ?? suggested?.customRegion ?? "",
  }), [space, suggested]);
  const [values, setValues] = useState<SpaceFormValues>(initial);
  const [step, setStep] = useState(1);
  const { errorRef, scrollToError, stepStartRef } = useStepFormScroll(step);
  const [files, setFiles] = useState<File[]>(initialFiles);
  const effectiveFiles = controlledFiles ?? files;
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [availabilitySyncNotice, setAvailabilitySyncNotice] = useState("");
  const [submissionKey] = useState(() => crypto.randomUUID());
  const [verification, setVerification] = useState({
    contactName: space?.contactName ?? "",
    contactPhone: space?.contactPhone ?? "",
    relationshipType: (space?.relationshipType ?? "") as SpaceRelationshipType | "",
    relationshipDetail: space?.relationshipDetail ?? "",
    applicantNote: "",
  });
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);

  useEffect(() => {
    if (suggestedVersion > 1 && suggested) {
      setValues((current) => ({ ...current, ...suggested }));
    }
  }, [suggested, suggestedVersion]);

  const openHours = values.operatingHours.filter((item) => item.isOpen);
  const common = openHours[0] ?? values.operatingHours[0];
  const operatingSummary = openHours.map((item) => DAY_BY_VALUE[item.dayOfWeek]).join("·");

  function update<K extends keyof SpaceFormValues>(key: K, value: SpaceFormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFinalConfirmed(false);
    setError("");
  }

  function applyCommonHours(patch: Partial<SpaceOperatingHour>, selectedDays = values.availableDays) {
    const selected = new Set(selectedDays.map((day) => VALUE_BY_DAY[day]));
    const currentCommon = { startTime: common?.startTime ?? "09:00", endTime: common?.endTime ?? "22:00", hasBreak: common?.hasBreak ?? false, breakStartTime: common?.breakStartTime ?? null, breakEndTime: common?.breakEndTime ?? null, ...patch };
    setValues((current) => {
      const operatingHours = DAYS.map(({ value }) => ({
        dayOfWeek: value,
        isOpen: selected.has(value),
        startTime: selected.has(value) ? currentCommon.startTime : null,
        endTime: selected.has(value) ? currentCommon.endTime : null,
        hasBreak: selected.has(value) && Boolean(currentCommon.hasBreak),
        breakStartTime: selected.has(value) && currentCommon.hasBreak ? currentCommon.breakStartTime : null,
        breakEndTime: selected.has(value) && currentCommon.hasBreak ? currentCommon.breakEndTime : null,
      }));
      return {
        ...current,
        availableDays: selectedDays,
        availableStartTime: currentCommon.startTime,
        availableEndTime: currentCommon.endTime,
        operatingHours,
        communityAvailability: current.communityAvailabilityAutoSync
          ? availabilityFromOperatingHours(operatingHours)
          : current.communityAvailability,
      };
    });
  }

  function toggleCommonDay(label: string) {
    const selected = values.availableDays.includes(label)
      ? values.availableDays.filter((day) => day !== label)
      : [...values.availableDays, label];
    selected.sort((a, b) => DAYS.findIndex((day) => day.label === a) - DAYS.findIndex((day) => day.label === b));
    applyCommonHours({}, selected);
  }

  function changeSpecificHour(dayOfWeek: number, patch: Partial<SpaceOperatingHour>) {
    setValues((current) => {
      const operatingHours = current.operatingHours.map((item) => item.dayOfWeek === dayOfWeek ? { ...item, ...patch } : item);
      return {
        ...current,
        operatingHours,
        communityAvailability: current.communityAvailabilityAutoSync
          ? availabilityFromOperatingHours(operatingHours)
          : current.communityAvailability,
      };
    });
    setFinalConfirmed(false);
    setError("");
  }

  function toggleSpecificHours(checked: boolean) {
    if (!checked && values.usesDaySpecificHours && !window.confirm("요일별로 입력한 운영 시간이 공통 운영 시간으로 변경됩니다. 적용할 공통 운영 시간을 확인해주세요.")) return;
    if (checked) {
      setValues((current) => ({ ...current, usesDaySpecificHours: true }));
    } else {
      applyCommonHours({});
      setValues((current) => ({ ...current, usesDaySpecificHours: false }));
    }
  }

  function toggleCommunityDay(dayOfWeek: number) {
    const exists = values.communityAvailability.some((item) => item.dayOfWeek === dayOfWeek);
    const operating = values.operatingHours.find((item) => item.dayOfWeek === dayOfWeek);
    setValues((current) => ({
      ...current,
      communityAvailabilityAutoSync: false,
      communityAvailability: exists
        ? current.communityAvailability.filter((item) => item.dayOfWeek !== dayOfWeek)
        : [...current.communityAvailability, {
          dayOfWeek,
          startTime: operating?.startTime ?? "10:00",
          endTime: operating?.endTime ?? "20:00",
        }],
    }));
    setAvailabilitySyncNotice("직접 수정한 커뮤니티 이용 가능 시간을 보호하기 위해 운영 시간 자동 연동을 해제했어요.");
    setFinalConfirmed(false);
    setError("");
  }

  function updateCommunityTime(dayOfWeek: number, key: "startTime" | "endTime", value: string) {
    setValues((current) => ({
      ...current,
      communityAvailabilityAutoSync: false,
      communityAvailability: current.communityAvailability.map((item) => item.dayOfWeek === dayOfWeek ? { ...item, [key]: value } : item),
    }));
    setAvailabilitySyncNotice("직접 수정한 값은 유지됩니다. 운영 시간과의 자동 연동은 해제되었어요.");
    setFinalConfirmed(false);
    setError("");
  }

  function selectCommunityUseMode(mode: CommunityUseMode) {
    setValues((current) => ({
      ...current,
      communityUseMode: mode,
      communityAvailability: mode !== "request_consultation" && current.communityAvailabilityAutoSync
        ? availabilityFromOperatingHours(current.operatingHours)
        : current.communityAvailability,
    }));
    setAvailabilitySyncNotice("");
    setFinalConfirmed(false);
    setError("");
  }

  function setAvailabilityAutoSync(checked: boolean) {
    setValues((current) => ({
      ...current,
      communityAvailabilityAutoSync: checked,
      communityAvailability: checked
        ? availabilityFromOperatingHours(current.operatingHours)
        : current.communityAvailability,
    }));
    setAvailabilitySyncNotice(checked
      ? "현재 운영 요일과 시간을 기준으로 자동 설정했어요."
      : "현재 값은 유지됩니다. 이제 커뮤니티 이용 가능 시간을 직접 설정할 수 있어요.");
    setFinalConfirmed(false);
    setError("");
  }

  function toggleList(key: "facilities" | "moods" | "suitableActivities", value: string) {
    update(key, values[key].includes(value) ? values[key].filter((item) => item !== value) : [...values[key], value]);
  }

  function add(list: File[]) {
    const unique = list.filter((file) => !files.some((item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified));
    if (files.length + (space?.images.length ?? 0) + unique.length > 10) return setError("사진은 최대 10장까지 등록할 수 있어요.");
    if (unique.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) return setError("JPG, PNG 또는 WEBP 형식의 사진을 올려주세요.");
    if (unique.some((file) => file.size > 10_485_760)) return setError("사진 한 장의 용량은 최대 10MB까지 가능합니다.");
    setFiles((current) => [...current, ...unique]);
    setError("");
  }
  function moveFile(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const next = [...files];
    [next[index], next[target]] = [next[target], next[index]];
    setFiles(next);
  }
  function makeThumbnail(index: number) {
    if (index > 0) setFiles([files[index], ...files.filter((_, itemIndex) => itemIndex !== index)]);
  }

  function selectRoadAddress(address: StructuredSpaceAddress) {
    setValues((current) => {
      const changed = Boolean(current.address && current.address !== address.roadAddress);
      const keepDetail = !changed || !current.addressDetail?.trim()
        || window.confirm("도로명 주소가 변경되었습니다. 기존 상세 주소를 그대로 유지할까요?\n취소를 누르면 상세 주소를 비웁니다.");
      return {
        ...current,
        ...address,
        address: address.roadAddress,
        addressDetail: keepDetail ? current.addressDetail : "",
        customRegion: "",
      };
    });
    setError("");
  }

  function validateStep(target: number, intent: "draft" | "pending" = "pending") {
    if (values.name.trim().length < 2) return "공간명은 2자 이상 입력해 주세요.";
    if (intent === "draft") return "";
    const unchangedLegacyAddress = Boolean(space && !space.roadAddress && values.address.trim() === space.address.trim());
    const selectedRoadAddress = Boolean(values.roadAddress?.trim() && values.address.trim() === values.roadAddress.trim());
    if (target >= 1 && !selectedRoadAddress && !unchangedLegacyAddress) return "주소 검색을 통해 도로명 주소를 선택해주세요.";
    if (target >= 1 && !values.spaceType) return "공간 유형을 선택해 주세요.";
    if (target >= 1 && (values.shortDescription?.trim().length ?? 0) < 5) return "한 줄 소개는 5자 이상 입력해 주세요.";
    if (target >= 1 && (values.description?.trim().length ?? 0) < 10) return "상세 소개는 10자 이상 입력해 주세요.";
    if (target >= 1 && (!values.detailedRegion || !values.address.trim())) return "주소와 지역 정보를 확인해 주세요.";
    if (target >= 1 && values.detailedRegion === "기타" && !values.customRegion?.trim()) return "기타 지역명을 입력해 주세요.";
    if (target >= 2) {
      if (!openHours.length) return "운영 요일을 한 개 이상 선택해 주세요.";
      const invalid = openHours.find((hour) => !validRange(hour.startTime, hour.endTime) || !validBreak(hour));
      if (invalid) return `${DAY_BY_VALUE[invalid.dayOfWeek]}요일 운영 시간 또는 브레이크 타임을 확인해 주세요. 자정을 넘기는 운영 시간은 18:00~02:00처럼 입력할 수 있어요.`;
      if (values.communityUseMode !== "request_consultation") {
        if (!values.communityAvailability.length) return "커뮤니티 이용 가능 요일을 한 개 이상 선택해 주세요.";
        const invalidAvailability = values.communityAvailability.find((item) => !validRange(item.startTime, item.endTime));
        if (invalidAvailability) return `${DAY_BY_VALUE[invalidAvailability.dayOfWeek]}요일 커뮤니티 이용 가능 시간을 확인해 주세요.`;
        if (values.communityUseMode === "during_operation") {
          const outsideOperatingHours = values.communityAvailability.find((item) =>
            !availabilityFitsOperatingHour(item, values.operatingHours.find((hour) => hour.dayOfWeek === item.dayOfWeek)));
          if (outsideOperatingHours) return "커뮤니티 이용 가능 시간은 해당 요일의 운영 시간 안에서 설정해주세요. 브레이크 타임과 겹치지 않는지도 확인해주세요.";
        }
        if (values.communityRecurrenceType === "date_range" && (!values.communityAvailabilityStartDate || !values.communityAvailabilityEndDate)) return "적용 기간의 시작일과 종료일을 입력해 주세요.";
        if (values.communityRecurrenceType === "specific_dates" && !values.communitySpecificDates.length) return "커뮤니티 이용 가능한 날짜를 한 개 이상 추가해 주세요.";
      }
      if (!values.preferredContactMethod || !values.privateContact?.trim()) return "협의 연락 방법과 연락 정보를 입력해 주세요.";
      if (values.preferredContactMethod === "store_phone" && /^(\+?82[-\s]?)?0?1[016789][-\s]?/i.test(values.privateContact.replace(/[()]/g, ""))) return "개인 휴대전화번호가 아닌 매장 대표 전화번호를 입력해 주세요.";
    }
    if (target >= 3) {
      if (values.pricePerHour < 0 || values.minimumHours < 1 || values.minCapacity < 1 || values.maxCapacity < 1) return "가격과 이용 인원을 확인해 주세요.";
      if (values.minCapacity > values.maxCapacity) return "최소 인원은 최대 인원보다 클 수 없어요.";
      if (values.suitableCapacity && (values.suitableCapacity < values.minCapacity || values.suitableCapacity > values.maxCapacity)) return "적정 인원은 최소·최대 인원 범위 안이어야 해요.";
    }
    if (target >= 4) {
      if (!space?.images.length && !effectiveFiles.length) return "대표 이미지를 등록해 주세요.";
      if ((values.usageRules?.trim().length ?? 0) < 5) return "이용 규칙은 5자 이상 입력해 주세요.";
      if (!verification.contactName.trim() || !verification.contactPhone.trim() || !verification.relationshipType) return "담당자 연락처와 공간과의 관계를 입력해 주세요.";
      if (verification.relationshipType === "other" && !verification.relationshipDetail.trim()) return "공간과의 관계를 직접 입력해 주세요.";
      if (evidenceFiles.length < 1 || evidenceFiles.length > 3) return "공간 운영 권한 증빙자료를 1개 이상 3개 이하로 첨부해 주세요.";
      if (!finalConfirmed) return "입력한 운영 정보와 이용 규칙을 확인했다는 항목을 체크해 주세요.";
    }
    return "";
  }

  async function next() {
    const problem = validateStep(step);
    if (problem) {
      setError(problem);
      scrollToError();
      return;
    }
    setError("");
    setStep((current) => Math.min(4, current + 1));
  }

  async function save(intent: "draft" | "pending") {
    const problem = validateStep(intent === "draft" ? step : 4, intent);
    if (problem) {
      setError(problem);
      if (intent === "pending") scrollToError();
      return;
    }
    setSaving(true);
    setError("");
    try {
      const first = values.operatingHours.find((item) => item.isOpen);
      const normalized = {
        ...values,
        mainRegion: PRIMARY_REGION,
        customRegion: values.detailedRegion === "기타" ? values.customRegion : "",
        availableDays: values.operatingHours.filter((item) => item.isOpen).map((item) => DAY_BY_VALUE[item.dayOfWeek]),
        availableStartTime: first?.startTime ?? null,
        availableEndTime: first?.endTime ?? null,
        regularUseAvailable: values.communityRecurrenceType === "weekly",
        status: space?.status ?? "draft",
      };
      const verificationPayload = { ...verification, idempotencyKey: submissionKey };
      if (space) {
        const response = await fetch(`/api/spaces/${space.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(normalized) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        if (effectiveFiles.length) {
          const form = new FormData();
          effectiveFiles.forEach((file) => form.append("images", file));
          const upload = await fetch(`/api/spaces/${space.id}/images`, { method: "POST", body: form });
          if (!upload.ok) throw new Error("이미지를 업로드하지 못했어요.");
        }
        if (intent === "pending") {
          const form = new FormData();
          form.set("verification", JSON.stringify(verificationPayload));
          evidenceFiles.forEach((file) => form.append("evidence", file));
          const submit = await fetch(`/api/spaces/${space.id}/verification`, { method: "POST", body: form });
          const result = await submit.json();
          if (!submit.ok) throw new Error(result.message);
        }
        router.push("/dashboard/spaces");
        router.refresh();
      } else {
        const form = new FormData();
        form.set("values", JSON.stringify(normalized));
        form.set("intent", intent);
        if (intent === "pending") form.set("verification", JSON.stringify(verificationPayload));
        effectiveFiles.forEach((file) => form.append("images", file));
        evidenceFiles.forEach((file) => form.append("evidence", file));
        const response = await fetch("/api/spaces", { method: "POST", body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);
        router.push(`/spaces/register/complete?name=${encodeURIComponent(result.name)}&slug=${result.slug}&status=${result.status}&image=${encodeURIComponent(result.thumbnail_url ?? "")}`);
      }
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "공간 정보를 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  }

  const input = (label: string, key: keyof SpaceFormValues, type = "text") => {
    const minimum = key === "name" ? 2 : key === "shortDescription" ? 5 : undefined;
    const displayedValue = type === "number" && Number(values[key]) === 0 ? "" : String(values[key] ?? "");
    return <label>{label}<input className="field" type={type} inputMode={type === "number" ? "decimal" : undefined} required={Boolean(minimum)} minLength={minimum} value={displayedValue} placeholder={type === "number" ? "0" : undefined} onChange={(event) => update(key, (type === "number" ? Number(event.target.value) : event.target.value) as never)} />{minimum && <span className="field-help">{minimum}자 이상 입력해 주세요.</span>}</label>;
  };
  const chips = (key: "facilities" | "moods" | "suitableActivities", title: string, customLabel: string, tip: string) => {
    const preset = options[key] as readonly string[];
    const customValues = values[key].filter((item) => !preset.includes(item));
    return <fieldset><legend>{title}</legend><div className="category-row">{preset.map((item) => <button type="button" className={`category ${values[key].includes(item) ? "active" : ""}`} onClick={() => toggleList(key, item)} key={item}>{item}</button>)}</div><CustomTagInput values={customValues} onChange={(custom) => update(key, [...values[key].filter((item) => preset.includes(item)), ...custom])} addLabel={customLabel} />{!assisted && <FieldTip>{tip}</FieldTip>}</fieldset>;
  };

  return <div className="form space-registration-wizard">
    {assisted && <aside className="registration-guide"><Sparkles /><div><strong>모디자가 사진 분석 초안을 반영했어요.</strong><p>선택된 시설과 분위기, 적합한 활동을 확인하고 실제 공간과 다른 부분은 자유롭게 수정해 주세요.</p></div></aside>}
    <section ref={stepStartRef} className="panel registration-progress">
      <div className="section-heading"><div><p className="eyebrow">Space registration</p><h2>공간 등록</h2></div><strong>{step * 25}%</strong></div>
      <div className="progress-track"><i style={{ width: `${step * 25}%` }} /></div>
      <div className="registration-progress-items">{steps.map((label, index) => <span className={step > index + 1 ? "done" : step === index + 1 ? "active" : ""} key={label}>{step > index + 1 ? <Check size={15} /> : "○"}{label}</span>)}</div>
    </section>
    <ol className="wizard-steps space-wizard-steps">{steps.map((label, index) => <li key={label} className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""}><span>{step > index + 1 ? <Check size={15} /> : index + 1}</span><b>{label}</b></li>)}</ol>

    {step === 1 && <>
      <section className="panel wizard-panel"><p className="eyebrow">Step 1</p><h2>기본 정보</h2><div className="grid form-grid">{input("공간명", "name")}<label>공간 유형<select className="field" value={values.spaceType} onChange={(event) => update("spaceType", event.target.value)}><option value="">선택</option>{["카페", "스튜디오", "공방", "회의실", "연습실", "복합문화공간", "독립 공간", "기타"].map((item) => <option key={item}>{item}</option>)}</select></label></div>{input("한 줄 소개", "shortDescription")}<label>상세 소개<textarea className="field" required minLength={10} rows={5} value={values.description ?? ""} onChange={(event) => update("description", event.target.value)} /><span className="field-help">10자 이상 입력해 주세요.</span></label></section>
      <section className="panel wizard-panel"><h2>위치 및 지역</h2>
        {!space && suggested?.address && !values.roadAddress && <p className="prefilled-address-note">운영자 신청에서 입력한 주소를 참고용으로 불러왔어요. 공개할 주소는 아래 주소 검색을 통해 다시 선택해주세요.</p>}
        {space && !space.roadAddress && <p className="prefilled-address-note">기존 자유 입력 주소는 그대로 유지되고 있습니다. 주소를 변경하려면 주소 검색을 이용해주세요.</p>}
        <RoadAddressSearch address={values.roadAddress || values.address} structured={Boolean(values.roadAddress)} onSelect={selectRoadAddress} />
        <label>상세 주소 <span className="muted">(선택)</span><input className="field" value={values.addressDetail ?? ""} onChange={(event) => update("addressDetail", event.target.value)} placeholder="건물명, 층, 호수 등 상세 위치를 입력해주세요." /></label>
        <RegionFields mainRegion={values.mainRegion} detailedRegion={values.detailedRegion ?? ""} customRegion={values.customRegion} onChange={() => undefined} disabled />
        <p className="field-help">선택한 도로명 주소를 기준으로 대표 지역과 세부 지역이 자동 설정됩니다.</p>
      </section>
    </>}

    {step === 2 && <>
      <section className="panel wizard-panel"><p className="eyebrow">Step 2</p><h2>운영 시간 설정</h2><p className="muted">대부분의 요일이 같다면 공통 운영 시간을 입력하세요. 정기 휴무일은 운영 요일에서 선택하지 않으면 됩니다.</p>
        <fieldset><legend>운영 요일</legend><div className="category-row">{DAYS.map((day) => <button type="button" key={day.value} className={`category ${values.availableDays.includes(day.label) ? "active" : ""}`} onClick={() => toggleCommonDay(day.label)}>{day.label}</button>)}</div></fieldset>
        <div className="grid form-grid"><label>운영 시작 시간<input className="field" type="time" value={common?.startTime ?? "09:00"} onChange={(event) => applyCommonHours({ startTime: event.target.value })} /></label><label>운영 종료 시간<input className="field" type="time" value={common?.endTime ?? "22:00"} onChange={(event) => applyCommonHours({ endTime: event.target.value })} /></label></div>
        <label className="checkbox-label"><input type="checkbox" checked={Boolean(common?.hasBreak)} onChange={(event) => applyCommonHours({ hasBreak: event.target.checked, breakStartTime: event.target.checked ? common?.breakStartTime ?? "15:00" : null, breakEndTime: event.target.checked ? common?.breakEndTime ?? "17:00" : null })} />브레이크 타임 있음</label>
        {common?.hasBreak && <div className="grid form-grid"><label>브레이크 시작<input className="field" type="time" value={common.breakStartTime ?? ""} onChange={(event) => applyCommonHours({ breakStartTime: event.target.value })} /></label><label>브레이크 종료<input className="field" type="time" value={common.breakEndTime ?? ""} onChange={(event) => applyCommonHours({ breakEndTime: event.target.value })} /></label></div>}
        <div className="automatic-window"><strong>{operatingSummary || "운영 요일 미선택"} {common?.startTime ?? ""}{common?.startTime ? "~" : ""}{common?.endTime ?? ""}</strong><span>정기 휴무: {DAYS.filter((day) => !values.availableDays.includes(day.label)).map((day) => `${day.label}요일`).join(", ") || "없음"}{common?.hasBreak ? ` · 브레이크 ${common.breakStartTime}~${common.breakEndTime}` : ""}</span></div>
        <label className="checkbox-label"><input type="checkbox" checked={values.usesDaySpecificHours} onChange={(event) => toggleSpecificHours(event.target.checked)} />요일마다 운영 시간이 달라요</label>
        {values.usesDaySpecificHours && <div className="day-hours-list">{DAYS.map((day) => {
          const hour = values.operatingHours.find((item) => item.dayOfWeek === day.value) ?? { dayOfWeek: day.value, isOpen: false, hasBreak: false };
          return <article className="day-hours-card" key={day.value}><label className="checkbox-label"><input type="checkbox" checked={hour.isOpen} onChange={(event) => changeSpecificHour(day.value, { isOpen: event.target.checked, startTime: event.target.checked ? hour.startTime ?? "09:00" : null, endTime: event.target.checked ? hour.endTime ?? "22:00" : null })} /><strong>{day.label}요일</strong>{!hour.isOpen && <span className="muted">휴무</span>}</label>{hour.isOpen && <><div className="day-time-row"><input className="field" type="time" value={hour.startTime ?? ""} onChange={(event) => changeSpecificHour(day.value, { startTime: event.target.value })} /><span>~</span><input className="field" type="time" value={hour.endTime ?? ""} onChange={(event) => changeSpecificHour(day.value, { endTime: event.target.value })} /></div><label className="checkbox-label"><input type="checkbox" checked={hour.hasBreak} onChange={(event) => changeSpecificHour(day.value, { hasBreak: event.target.checked, breakStartTime: event.target.checked ? hour.breakStartTime ?? "15:00" : null, breakEndTime: event.target.checked ? hour.breakEndTime ?? "17:00" : null })} />브레이크 타임</label>{hour.hasBreak && <div className="day-time-row"><input className="field" type="time" value={hour.breakStartTime ?? ""} onChange={(event) => changeSpecificHour(day.value, { breakStartTime: event.target.value })} /><span>~</span><input className="field" type="time" value={hour.breakEndTime ?? ""} onChange={(event) => changeSpecificHour(day.value, { breakEndTime: event.target.value })} /></div>}</>}</article>;
        })}</div>}
      </section>
      <section className="panel wizard-panel"><h2>커뮤니티 이용 방식</h2><p className="muted">공간 운영 시간과 별도로 커뮤니티에 실제로 제공할 수 있는 방식을 선택해 주세요.</p>
        <div className="community-use-mode-grid">{([
          ["idle_time_only", "비는 시간에만 이용 가능", "평소 사용하지 않는 시간대를 커뮤니티에 제공합니다."],
          ["during_operation", "운영 시간에도 이용 가능", "공간 운영 중에도 커뮤니티 이용 요청을 받습니다."],
          ["request_consultation", "요청 후 협의", "요청을 받은 뒤 운영자가 이용 가능 여부와 일정을 결정합니다."],
        ] as [CommunityUseMode, string, string][]).map(([mode, title, description]) => <button type="button" key={mode} className={`mode-choice ${values.communityUseMode === mode ? "active" : ""}`} onClick={() => selectCommunityUseMode(mode)}><strong>{title}</strong><span>{description}</span></button>)}</div>
        {values.communityUseMode !== "request_consultation" ? <>
          <div className="availability-sync-control">
            <label className="checkbox-label"><input type="checkbox" checked={values.communityAvailabilityAutoSync} onChange={(event) => setAvailabilityAutoSync(event.target.checked)} /><span><strong>운영 시간 기준으로 자동 설정</strong><small>운영 요일과 요일별 시간을 커뮤니티 이용 가능 시간에 그대로 반영합니다.</small></span></label>
            <p className="field-help">체크를 해제하면 현재 값은 유지되며, 이 공간의 커뮤니티 이용 가능 시간을 직접 설정할 수 있습니다.</p>
            {values.communityUseMode === "idle_time_only" && <p className="field-help">운영 시간을 기준으로 기본값을 입력했습니다. 커뮤니티에 실제로 제공할 수 있는 시간으로 수정해주세요.</p>}
            {availabilitySyncNotice && <p className="availability-sync-notice">{availabilitySyncNotice}</p>}
          </div>
          <fieldset><legend>커뮤니티 이용 가능 요일</legend><div className="category-row">{DAYS.map((day) => <button type="button" className={`category ${values.communityAvailability.some((item) => item.dayOfWeek === day.value) ? "active" : ""}`} onClick={() => toggleCommunityDay(day.value)} key={day.value}>{day.label}</button>)}</div></fieldset>
          <div className="day-hours-list">{[...values.communityAvailability].sort((a, b) => DAYS.findIndex((day) => day.value === a.dayOfWeek) - DAYS.findIndex((day) => day.value === b.dayOfWeek)).map((item) => <article className="day-hours-card compact" key={item.dayOfWeek}><strong>{DAY_BY_VALUE[item.dayOfWeek]}요일</strong><div className="day-time-row"><input className="field" type="time" value={item.startTime ?? ""} onChange={(event) => updateCommunityTime(item.dayOfWeek, "startTime", event.target.value)} /><span>~</span><input className="field" type="time" value={item.endTime ?? ""} onChange={(event) => updateCommunityTime(item.dayOfWeek, "endTime", event.target.value)} /></div></article>)}</div>
          <label>반복 방식<select className="field" value={values.communityRecurrenceType} onChange={(event) => update("communityRecurrenceType", event.target.value as SpaceFormValues["communityRecurrenceType"])}><option value="weekly">매주 반복</option><option value="date_range">특정 기간만 적용</option><option value="specific_dates">직접 날짜 선택</option></select></label>
          {values.communityRecurrenceType === "date_range" && <div className="grid form-grid"><label>시작일<input className="field" type="date" value={values.communityAvailabilityStartDate ?? ""} onChange={(event) => update("communityAvailabilityStartDate", event.target.value)} /></label><label>종료일<input className="field" type="date" value={values.communityAvailabilityEndDate ?? ""} onChange={(event) => update("communityAvailabilityEndDate", event.target.value)} /></label></div>}
          {values.communityRecurrenceType === "specific_dates" && <CustomTagInput values={values.communitySpecificDates} onChange={(dates) => update("communitySpecificDates", dates)} addLabel="이용 날짜 추가" placeholder="2026-07-25 입력 후 Enter" max={12} />}
          {values.communityUseMode === "during_operation" && <><label>최소 주문 또는 이용료<input className="field" value={values.minimumOrderOrFee ?? ""} onChange={(event) => update("minimumOrderOrFee", event.target.value)} placeholder="예: 1인 1음료" /></label><label>추가 이용 조건<textarea className="field" rows={3} value={values.additionalUseConditions ?? ""} onChange={(event) => update("additionalUseConditions", event.target.value)} placeholder="예: 일반 영업과 함께 이용하며 공간 전체 대관은 어렵습니다." /></label></>}
        </> : <div className="automatic-window"><strong>운영자와 협의 후 이용</strong><span>희망 일정과 이용 조건을 요청으로 전달받아 승인 여부를 결정합니다.</span></div>}
        <fieldset className="contact-fieldset"><legend>협의 연락 수단 <span className="field-required">필수</span></legend>
          <div className="space-contact-override">
            <fieldset><legend>협의 연락 방법</legend><div className="choice-row">
              {CONTACT_METHODS.map((method) => <label className="radio-choice" key={method.value}>
                <input type="radio" name="spaceContactMethod" checked={values.preferredContactMethod === method.value} onChange={() => update("preferredContactMethod", method.value)} />
                {method.label}
              </label>)}
            </div></fieldset>
            <label>연락 정보<input
              className="field"
              value={values.privateContact ?? ""}
              onChange={(event) => update("privateContact", event.target.value)}
              inputMode={values.preferredContactMethod === "store_phone" ? "tel" : "url"}
              placeholder={values.preferredContactMethod ? CONTACT_PLACEHOLDERS[values.preferredContactMethod] : "먼저 협의 연락 방법을 선택해주세요."}
            />{values.preferredContactMethod === "store_phone" && <span className="field-help contact-mobile-guidance">개인 휴대전화번호가 아닌 매장 대표 전화번호를 입력해 주세요. 예: 053-123-4567</span>}</label>
          </div>
          <p className="field-help">등록한 연락 수단은 공간 상세의 이용 정보에 표시됩니다. 이용 문의가 들어오면 필요한 일정과 조건을 이 방법으로 협의할 수 있어요.</p>
        </fieldset>
      </section>
    </>}

    {step === 3 && <>
      <section className="panel wizard-panel"><p className="eyebrow">Step 3</p><h2>이용 조건</h2><div className="grid form-grid">{input("시간당 가격", "pricePerHour", "number")}{input("최소 이용 시간", "minimumHours", "number")}{input("최소 이용 인원", "minCapacity", "number")}{input("적정 인원", "suitableCapacity", "number")}{input("최대 이용 인원", "maxCapacity", "number")}</div>{values.communityUseMode !== "during_operation" && <label>최소 주문 또는 이용료 <span className="muted">(선택)</span><input className="field" value={values.minimumOrderOrFee ?? ""} onChange={(event) => update("minimumOrderOrFee", event.target.value)} placeholder="예: 시간당 30,000원 또는 1인 1음료" /></label>}</section>
      <section className="panel wizard-panel"><h2>시설 및 이용 조건</h2>{chips("facilities", "제공 시설", "기타 시설 추가", "참가자가 실제로 사용할 수 있는 시설 위주로 선택해 주세요.")}{chips("moods", "공간 분위기", "기타 분위기 추가", "참가자가 공간에 들어왔을 때 느끼는 분위기를 선택해 주세요.")}{chips("suitableActivities", "이용 가능한 활동", "기타 활동 추가", "이 공간에서 실제로 진행하기 좋은 활동을 선택해 주세요.")}<CustomTagInput values={values.difficultActivities} onChange={(tags) => update("difficultActivities", tags)} addLabel="이용이 어려운 활동 추가" placeholder="예: 드럼 연주, 대형 파티" /><label>소음 수준<select className="field" value={values.noiseLevel} onChange={(event) => update("noiseLevel", event.target.value as SpaceFormValues["noiseLevel"])}><option value="quiet">조용한 활동만</option><option value="moderate">일반 대화</option><option value="active">활발한 활동</option></select></label><div className="meta">{[["foodAllowed", "음식물 반입"], ["alcoholAllowed", "주류"], ["furnitureMovable", "가구 이동"], ["parkingAvailable", "주차"]].map(([key, title]) => <label className="checkbox-label" key={key}><input type="checkbox" checked={Boolean(values[key as keyof SpaceFormValues])} onChange={(event) => update(key as keyof SpaceFormValues, event.target.checked as never)} />{title}</label>)}</div></section>
    </>}

    {step === 4 && <>
      {!hidePhotoSection && <section className="panel wizard-panel"><p className="eyebrow">Step 4</p><h2>사진 업로드</h2><label className="upload" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); add(Array.from(event.dataTransfer.files)); }}><ImagePlus style={{ margin: "auto" }} /><b>사진을 선택하거나 끌어다 놓으세요</b><span>최대 10장 · JPG, PNG, WebP · 장당 10MB 이하</span><input hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { add(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} /></label><div className="grid cards">{space?.images.map((image) => <div className="card" key={image.id}><div className="cover"><Image src={image.publicUrl} fill alt="공간 이미지" />{image.isThumbnail && <span className="tag">대표</span>}</div></div>)}{files.map((file, index) => <div className="card" key={`${file.name}-${file.size}-${file.lastModified}`}><div className="cover"><Image src={URL.createObjectURL(file)} fill unoptimized alt="미리보기" />{index === 0 && <span className="tag">대표</span>}</div><div className="photo-inline-actions"><button type="button" disabled={index === 0} onClick={() => moveFile(index, -1)}><ArrowLeft />앞으로</button><button type="button" disabled={index === files.length - 1} onClick={() => moveFile(index, 1)}><ArrowRight />뒤로</button>{index > 0 && <button type="button" onClick={() => makeThumbnail(index)}><Star />대표</button>}<button type="button" onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}><Trash2 />삭제</button></div></div>)}</div></section>}
      <section className="panel wizard-panel"><h2>이용 규칙</h2><p className="muted">커뮤니티 이용 때 지켜야 할 규칙이나 안내사항을 작성해 주세요. 운영자가 공간을 선택하거나 이용을 요청하기 전에 확인할 수 있습니다.</p><label>이용 규칙<textarea className="field" required minLength={5} rows={6} value={values.usageRules ?? ""} onChange={(event) => update("usageRules", event.target.value)} placeholder={"예: 일반 영업과 함께 이용하는 공간입니다.\n공간 전체를 단독으로 사용할 수 없습니다.\n1인 1음료 주문이 필요합니다.\n이용 후 자리를 정리해 주세요."} /><span className="field-help">5자 이상 입력해 주세요.</span></label><details className="field-tip"><summary><Lightbulb size={15} />예시 보기</summary><ul><li>외부 음식물 반입 여부</li><li>소음이 큰 활동이나 악기 연주 제한</li><li>예약 시간 전 입장 가능 여부</li><li>시설과 장비 사용 시 직원 안내 필요 여부</li></ul></details></section>
      {(!space || ["draft", "revision_requested", "rejected"].includes(space.status)) && <section className="panel verification-submit-panel"><div><p className="eyebrow">Space verification</p><h2>공간별 인증 신청</h2><p className="muted">공간 운영자 자격과 별개로 등록하는 각 공간의 운영 권한을 확인합니다. 승인 전에는 이용자에게 공개되지 않아요.</p></div><div className="grid form-grid"><label>담당자 이름<input className="field" value={verification.contactName} onChange={(event) => setVerification({ ...verification, contactName: event.target.value })} /></label><label>담당자 연락처<input className="field" value={verification.contactPhone} onChange={(event) => setVerification({ ...verification, contactPhone: event.target.value })} placeholder="010-0000-0000" /></label><label>공간과의 관계<select className="field" value={verification.relationshipType} onChange={(event) => setVerification({ ...verification, relationshipType: event.target.value as SpaceRelationshipType | "", relationshipDetail: event.target.value === "other" ? verification.relationshipDetail : "" })}><option value="">선택</option><option value="owner">직접 운영하는 소유자</option><option value="manager">공간 관리자 또는 공동대표</option><option value="employee">직원 또는 매니저</option><option value="tenant">임차인 또는 위임받은 운영자</option><option value="other">기타</option></select></label>{verification.relationshipType === "other" && <label>관계 직접 입력<input className="field" value={verification.relationshipDetail} onChange={(event) => setVerification({ ...verification, relationshipDetail: event.target.value })} /></label>}</div><label>추가 전달 사항 <span className="muted">(선택)</span><textarea className="field" rows={3} value={verification.applicantNote} onChange={(event) => setVerification({ ...verification, applicantNote: event.target.value })} /></label><label className="upload"><b>공간 운영 권한 증빙자료</b><span>PDF, JPG, JPEG, PNG · 파일당 10MB 이하 · 1~3개</span><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(event) => { const next = Array.from(event.target.files ?? []); if (next.length > 3) return setError("증빙자료는 최대 3개까지 첨부할 수 있어요."); if (next.some((file) => file.size > 10_485_760)) return setError("증빙자료는 파일당 최대 10MB까지 첨부할 수 있어요."); setEvidenceFiles(next); setError(""); event.currentTarget.value = ""; }} /></label>{evidenceFiles.length > 0 && <div className="evidence-file-list">{evidenceFiles.map((file, index) => <button type="button" className="category active custom-tag" key={`${file.name}-${file.size}`} onClick={() => setEvidenceFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB <Trash2 size={14} /></button>)}</div>}<small className="muted">사업자등록증, 임대차계약서, 재직증명서, 명함 또는 공간 관리자 화면처럼 운영 권한을 확인할 수 있는 자료를 첨부해 주세요.</small></section>}
      <section className="panel final-confirmation"><label className="checkbox-label"><input type="checkbox" checked={finalConfirmed} onChange={(event) => { setFinalConfirmed(event.target.checked); setError(""); }} /><span><strong>운영 시간, 커뮤니티 이용 가능 시간, 이용 규칙을 모두 확인했습니다.</strong><small>AI가 제안한 항목도 실제 공간과 일치하는지 운영자가 최종 확인해야 합니다.</small></span></label></section>
    </>}

    {space?.status === "pending" && <aside className="panel"><strong>관리자가 이 공간의 인증 자료를 확인하고 있어요.</strong><p className="muted">심사 중에는 공개되지 않으며 결과는 사이트 내 알림으로 안내합니다.</p></aside>}
    {error && <p ref={errorRef} className="error-summary" role="alert">{error}</p>}
    <div className="wizard-actions">
      {step > 1 && <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setStep((current) => current - 1)}><ArrowLeft />이전</button>}
      <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => void save("draft")}>{space ? "변경 내용 저장" : "임시 저장"}</button>
      {step < 4
        ? <button type="button" className="btn btn-primary" onClick={() => void next()}>다음<ArrowRight /></button>
        : (!space || ["draft", "revision_requested", "rejected"].includes(space.status)) && <button type="button" className="btn btn-primary" disabled={saving || !finalConfirmed} onClick={() => void save("pending")}>{saving ? "저장 중..." : "공간 인증 신청하기"}</button>}
    </div>
  </div>;
}
