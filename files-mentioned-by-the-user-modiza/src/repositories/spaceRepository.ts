import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateSpaceInput,
  Space,
  SpaceCommunityAvailability,
  SpaceImage,
  SpaceOperatingHour,
  SpaceVerificationRequest,
  UpdateSpaceInput,
} from "@/types/space";

const SPACE_SELECT =
  "*,space_images(*),space_operating_hours(*),space_community_availability(*)";
const MY_SPACE_SELECT =
  "*,space_images(*),space_operating_hours(*),space_community_availability(*),space_contact_settings(*),space_analysis(id,updated_at),space_verification_requests(*)";

const image = (row: any): SpaceImage => ({
  id: row.id,
  spaceId: row.space_id,
  storagePath: row.storage_path,
  publicUrl: row.public_url,
  fileName: row.file_name,
  mimeType: row.mime_type,
  fileSize: row.file_size,
  width: row.width,
  height: row.height,
  sortOrder: row.sort_order,
  isThumbnail: row.is_thumbnail,
  createdAt: row.created_at,
});

const operatingHour = (row: any): SpaceOperatingHour => ({
  id: row.id,
  spaceId: row.space_id,
  dayOfWeek: row.day_of_week,
  isOpen: row.is_open,
  startTime: row.start_time?.slice(0, 5) ?? null,
  endTime: row.end_time?.slice(0, 5) ?? null,
  hasBreak: row.has_break,
  breakStartTime: row.break_start_time?.slice(0, 5) ?? null,
  breakEndTime: row.break_end_time?.slice(0, 5) ?? null,
});

const availability = (row: any): SpaceCommunityAvailability => ({
  id: row.id,
  spaceId: row.space_id,
  dayOfWeek: row.day_of_week,
  startTime: row.start_time?.slice(0, 5) ?? null,
  endTime: row.end_time?.slice(0, 5) ?? null,
});

const verification = (row: any): SpaceVerificationRequest => ({
  id: row.id,
  spaceId: row.space_id,
  applicantId: row.applicant_id,
  status: row.status,
  contactName: row.contact_name,
  contactPhone: row.contact_phone,
  relationshipType: row.relationship_type,
  relationshipDetail: row.relationship_detail,
  applicantNote: row.applicant_note,
  revisionRequestReason: row.revision_request_reason,
  rejectionReason: row.rejection_reason,
  submittedAt: row.submitted_at,
  reviewedAt: row.reviewed_at,
  reviewedBy: row.reviewed_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const legacyOperatingHours = (row: any): SpaceOperatingHour[] => {
  const dayMap: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
  return (row.available_days ?? []).flatMap((day: string) => {
    const dayOfWeek = dayMap[day];
    if (dayOfWeek === undefined || !row.available_start_time || !row.available_end_time) return [];
    return [{
      dayOfWeek,
      isOpen: true,
      startTime: row.available_start_time.slice(0, 5),
      endTime: row.available_end_time.slice(0, 5),
      hasBreak: false,
    }];
  });
};

const map = (row: any): Space => {
  const structuredHours = (row.space_operating_hours ?? []).map(operatingHour);
  const contactSettings = Array.isArray(row.space_contact_settings)
    ? row.space_contact_settings[0]
    : row.space_contact_settings;
  return {
    id: row.id,
    ownerId: row.owner_id,
    operatorId: row.operator_id,
    name: row.name,
    slug: row.slug,
    spaceType: row.space_type,
    shortDescription: row.short_description,
    description: row.description,
    mainRegion: row.main_region,
    detailedRegion: row.detailed_region,
    customRegion: row.custom_region,
    address: row.address,
    addressDetail: row.address_detail,
    postalCode: row.postal_code,
    roadAddress: row.road_address,
    jibunAddress: row.jibun_address,
    buildingName: row.building_name,
    addressSido: row.address_sido,
    addressSigungu: row.address_sigungu,
    addressDong: row.address_dong,
    pricePerHour: row.price_per_hour,
    minimumHours: row.minimum_hours,
    minCapacity: row.min_capacity ?? 1,
    suitableCapacity: row.suitable_capacity,
    maxCapacity: row.max_capacity,
    availableDays: row.available_days ?? [],
    availableStartTime: row.available_start_time,
    availableEndTime: row.available_end_time,
    usesDaySpecificHours: row.uses_day_specific_hours ?? false,
    operatingHours: structuredHours.length ? structuredHours : legacyOperatingHours(row),
    communityUseMode: row.community_use_mode ?? "request_consultation",
    communityAvailability: (row.space_community_availability ?? []).map(availability),
    communityAvailabilityAutoSync: row.community_availability_auto_sync ?? false,
    communityRecurrenceType: row.community_recurrence_type ?? "weekly",
    communityAvailabilityStartDate: row.community_availability_start_date,
    communityAvailabilityEndDate: row.community_availability_end_date,
    communitySpecificDates: row.community_specific_dates ?? [],
    minimumOrderOrFee: row.minimum_order_or_fee,
    additionalUseConditions: row.additional_use_conditions,
    useHostContact: contactSettings?.use_host_contact ?? true,
    preferredContactMethod: row.negotiation_contact_method ?? contactSettings?.contact_method ?? null,
    privateContact: row.negotiation_contact_value ?? contactSettings?.contact_value ?? null,
    usageRules: row.usage_rules,
    difficultActivities: row.difficult_activities ?? [],
    regularUseAvailable: row.regular_use_available,
    facilities: row.facilities ?? [],
    moods: row.moods ?? [],
    suitableActivities: row.suitable_activities ?? [],
    noiseLevel: row.noise_level,
    foodAllowed: row.food_allowed,
    alcoholAllowed: row.alcohol_allowed,
    furnitureMovable: row.furniture_movable,
    parkingAvailable: row.parking_available,
    thumbnailUrl: row.thumbnail_url,
    status: row.status,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    relationshipType: row.relationship_type,
    relationshipDetail: row.relationship_detail,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    suspendedAt: row.suspended_at,
    suspensionReason: row.suspension_reason,
    latestVerification:
      Array.isArray(row.space_verification_requests) && row.space_verification_requests[0]
        ? verification(row.space_verification_requests[0])
        : null,
    images: (row.space_images ?? [])
      .map(image)
      .sort((a: SpaceImage, b: SpaceImage) => a.sortOrder - b.sortOrder),
    analysisUpdatedAt: Array.isArray(row.space_analysis)
      ? row.space_analysis[0]?.updated_at ?? null
      : row.space_analysis?.updated_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const payload = (values: UpdateSpaceInput) => ({
  name: values.name,
  space_type: values.spaceType,
  short_description: values.shortDescription,
  description: values.description,
  main_region: values.mainRegion,
  detailed_region: values.detailedRegion,
  custom_region: values.detailedRegion === "기타" ? values.customRegion || null : null,
  address: values.address,
  address_detail: values.addressDetail,
  postal_code: values.postalCode || null,
  road_address: values.roadAddress || null,
  jibun_address: values.jibunAddress || null,
  building_name: values.buildingName || null,
  address_sido: values.addressSido || null,
  address_sigungu: values.addressSigungu || null,
  address_dong: values.addressDong || null,
  price_per_hour: values.pricePerHour,
  minimum_hours: values.minimumHours,
  min_capacity: values.minCapacity,
  suitable_capacity: values.suitableCapacity,
  max_capacity: values.maxCapacity,
  available_days: values.availableDays,
  available_start_time: values.availableStartTime || null,
  available_end_time: values.availableEndTime || null,
  uses_day_specific_hours: values.usesDaySpecificHours,
  community_use_mode: values.communityUseMode,
  community_availability_auto_sync: values.communityAvailabilityAutoSync,
  community_recurrence_type: values.communityRecurrenceType,
  community_availability_start_date: values.communityAvailabilityStartDate || null,
  community_availability_end_date: values.communityAvailabilityEndDate || null,
  community_specific_dates: values.communitySpecificDates,
  minimum_order_or_fee: values.minimumOrderOrFee || null,
  additional_use_conditions: values.additionalUseConditions || null,
  negotiation_contact_method: values.preferredContactMethod || null,
  negotiation_contact_value: values.privateContact?.trim() || null,
  usage_rules: values.usageRules || null,
  difficult_activities: values.difficultActivities,
  regular_use_available: values.regularUseAvailable,
  facilities: values.facilities,
  moods: values.moods,
  suitable_activities: values.suitableActivities,
  noise_level: values.noiseLevel,
  food_allowed: values.foodAllowed,
  alcohol_allowed: values.alcoholAllowed,
  furniture_movable: values.furnitureMovable,
  parking_available: values.parkingAvailable,
});

async function currentUserId(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  return user.id;
}

function createSlug(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "space";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function syncSchedules(db: SupabaseClient, spaceId: string, values: UpdateSpaceInput) {
  if (values.operatingHours) {
    const removed = await db.from("space_operating_hours").delete().eq("space_id", spaceId);
    if (removed.error) throw removed.error;
    if (values.operatingHours.length) {
      const inserted = await db.from("space_operating_hours").insert(values.operatingHours.map((item) => ({
        space_id: spaceId,
        day_of_week: item.dayOfWeek,
        is_open: item.isOpen,
        start_time: item.isOpen ? item.startTime : null,
        end_time: item.isOpen ? item.endTime : null,
        has_break: item.isOpen && item.hasBreak,
        break_start_time: item.isOpen && item.hasBreak ? item.breakStartTime : null,
        break_end_time: item.isOpen && item.hasBreak ? item.breakEndTime : null,
      })));
      if (inserted.error) throw inserted.error;
    }
  }
  if (values.communityAvailability) {
    const removed = await db.from("space_community_availability").delete().eq("space_id", spaceId);
    if (removed.error) throw removed.error;
    const rows = values.communityAvailability.filter((item) => item.startTime && item.endTime);
    if (rows.length) {
      const inserted = await db.from("space_community_availability").insert(rows.map((item) => ({
        space_id: spaceId,
        day_of_week: item.dayOfWeek,
        start_time: item.startTime,
        end_time: item.endTime,
      })));
      if (inserted.error) throw inserted.error;
    }
  }
}

async function syncPrivateContact(db: SupabaseClient, spaceId: string, ownerId: string, values: UpdateSpaceInput) {
  if (values.useHostContact === undefined && values.preferredContactMethod === undefined && values.privateContact === undefined) return;
  const useHostContact = values.useHostContact ?? true;
  const { error } = await db.from("space_contact_settings").upsert({
    space_id: spaceId,
    owner_id: ownerId,
    use_host_contact: useHostContact,
    contact_method: useHostContact ? null : values.preferredContactMethod || null,
    contact_value: useHostContact ? null : values.privateContact?.trim() || null,
  }, { onConflict: "space_id" });
  if (error) throw error;
}

export async function getActiveSpaces(db: SupabaseClient) {
  const { data, error } = await db.from("spaces").select(SPACE_SELECT).eq("status", "approved").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}
export async function getSpaceBySlug(db: SupabaseClient, slug: string) {
  const { data, error } = await db.from("spaces").select(SPACE_SELECT).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? map(data) : null;
}
export async function getSpaceById(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("spaces").select(SPACE_SELECT).eq("id", id).eq("status", "approved").maybeSingle();
  if (error) throw error;
  return data ? map(data) : null;
}
export async function getMySpaces(db: SupabaseClient) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("spaces").select(MY_SPACE_SELECT).eq("owner_id", ownerId).order("updated_at", { ascending: false }).order("created_at", { referencedTable: "space_verification_requests", ascending: false });
  if (error) throw error;
  return (data ?? []).map(map);
}
export const getSpacesForDashboard = getMySpaces;
export async function getMySpaceById(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("spaces").select(MY_SPACE_SELECT).eq("id", id).eq("owner_id", ownerId).order("created_at", { referencedTable: "space_verification_requests", ascending: false }).maybeSingle();
  if (error) throw error;
  return data ? map(data) : null;
}

export async function createSpaceForCurrentUser(db: SupabaseClient, values: CreateSpaceInput) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("spaces").insert({
    ...payload(values),
    status: "draft",
    owner_id: ownerId,
    operator_id: null,
    slug: createSlug(values.name),
  }).select("id").single();
  if (error) throw error;
  await syncSchedules(db, data.id, values);
  await syncPrivateContact(db, data.id, ownerId, values);
  const created = await getMySpaceById(db, data.id);
  if (!created) throw new Error("SPACE_NOT_FOUND");
  return created;
}
export const createSpace = createSpaceForCurrentUser;

export async function updateMySpace(db: SupabaseClient, id: string, values: UpdateSpaceInput) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("spaces").update(payload(values)).eq("id", id).eq("owner_id", ownerId).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("SPACE_NOT_FOUND");
  await syncSchedules(db, id, values);
  await syncPrivateContact(db, id, ownerId, values);
  const updated = await getMySpaceById(db, id);
  if (!updated) throw new Error("SPACE_NOT_FOUND");
  return updated;
}
export const updateSpace = updateMySpace;

export async function cancelSpaceVerification(db: SupabaseClient, id: string) {
  const { error } = await db.rpc("cancel_space_verification", { p_space_id: id });
  if (error) throw error;
}
export async function createSpaceImage(db: SupabaseClient, values: Omit<SpaceImage, "id" | "createdAt">) {
  const { data, error } = await db.from("space_images").insert({
    space_id: values.spaceId,
    storage_path: values.storagePath,
    public_url: values.publicUrl,
    file_name: values.fileName,
    mime_type: values.mimeType,
    file_size: values.fileSize,
    width: values.width,
    height: values.height,
    sort_order: values.sortOrder,
    is_thumbnail: values.isThumbnail,
  }).select().single();
  if (error) throw error;
  return image(data);
}
export async function deleteSpaceImage(db: SupabaseClient, id: string) {
  const { error } = await db.from("space_images").delete().eq("id", id);
  if (error) throw error;
}
export async function reorderSpaceImages(db: SupabaseClient, ids: string[]) {
  await Promise.all(ids.map((id, sortOrder) => db.from("space_images").update({ sort_order: sortOrder }).eq("id", id)));
}
export async function setThumbnailImage(db: SupabaseClient, spaceId: string, imageId: string, url: string) {
  const ownerId = await currentUserId(db);
  await db.from("space_images").update({ is_thumbnail: false }).eq("space_id", spaceId);
  const { error } = await db.from("space_images").update({ is_thumbnail: true }).eq("id", imageId).eq("space_id", spaceId);
  if (error) throw error;
  const update = await db.from("spaces").update({ thumbnail_url: url }).eq("id", spaceId).eq("owner_id", ownerId);
  if (update.error) throw update.error;
}
export async function deleteMySpace(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const space = await getMySpaceById(db, id);
  if (!space) return;
  if (space.images.length) {
    const { error } = await db.storage.from("space-images").remove(space.images.map((item) => item.storagePath));
    if (error) throw new Error("STORAGE_DELETE_FAILED");
  }
  const { error } = await db.from("spaces").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}
export const deleteSpace = deleteMySpace;
