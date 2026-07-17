import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCommunityCategories, normalizeCommunityCategory } from "@/constants/taxonomy";
import type { Community, CommunityActivityImage, CommunityFormValues, CommunityHostProfile, CommunityStatus, RecruitmentStatus } from "@/types/community";

const ownerSelect = "*,community_applications(count)";

export function mapCommunity(row: any): Community {
  return {
    id: row.id, ownerId: row.owner_id, operatorId: row.operator_id,
    linkedSpaceId: row.linked_space_id ?? row.space_id, name: row.name, slug: row.slug,
    category: normalizeCommunityCategory(row.category), customCategory: row.custom_category, shortDescription: row.short_description,
    description: row.description, mainRegion: row.main_region ?? row.region,
    detailedRegion: row.detailed_region ?? "", customRegion: row.custom_region, thumbnailUrl: row.thumbnail_url,
    thumbnailStoragePath: row.thumbnail_storage_path, status: row.status,
    recruitmentStatus: row.recruitment_status, recruitmentStartAt: row.recruitment_start_at,
    recruitmentEndAt: row.recruitment_end_at, nextMeetingAt: row.next_meeting_at,
    meetingEndAt: row.meeting_end_at, capacity: row.capacity ?? 1,
    currentMembers: row.current_members ?? 0, participationFee: row.participation_fee ?? row.fee ?? 0,
    participationType: row.participation_type, targetAudience: row.target_audience ?? "",
    rules: row.rules ?? "", preparationItems: row.preparation_items ?? "",
    activityDescription: row.activity_description ?? "", moodTags: row.mood_tags ?? [],
    requiredFacilities: row.required_facilities ?? [], indoorOutdoor: row.indoor_outdoor ?? "indoor",
    foodDrinkNeeded: row.food_drink_needed ?? false, expectedDurationHours: Number(row.expected_duration_hours ?? 2),
    budgetMin: row.budget_min ?? 0, budgetMax: row.budget_max ?? 0, travelRange: row.travel_range ?? "",
    applicationQuestions: Array.isArray(row.application_questions) ? row.application_questions : [],
    meetingFrequencyType: row.meeting_frequency_type ?? "one_time", meetingFrequencyLabel: row.meeting_frequency_label ?? null,
    recommendedFor: row.recommended_for ?? [], participationNotices: row.participation_notices ?? [],
    durationMinutes: row.duration_minutes ?? Math.round(Number(row.expected_duration_hours ?? 2) * 60),
    tags: row.tags ?? [], createdAt: row.created_at, updatedAt: row.updated_at,
    applicationCount: row.community_applications?.[0]?.count ?? 0,
  };
}

const payload = (values: Partial<CommunityFormValues>) => ({
  ...(values.name !== undefined && { name: values.name }),
  ...(values.category !== undefined && { category: values.category }),
  ...(values.customCategory !== undefined && { custom_category: null }),
  ...(values.shortDescription !== undefined && { short_description: values.shortDescription }),
  ...(values.description !== undefined && { description: values.description }),
  ...(values.mainRegion !== undefined && { main_region: values.mainRegion, region: values.mainRegion }),
  ...(values.detailedRegion !== undefined && { detailed_region: values.detailedRegion }),
  ...(values.customRegion !== undefined && { custom_region: values.detailedRegion === "기타" ? values.customRegion || null : null }),
  ...(values.nextMeetingAt !== undefined && { next_meeting_at: values.nextMeetingAt }),
  ...(values.meetingEndAt !== undefined && { meeting_end_at: values.meetingEndAt || null }),
  ...(values.capacity !== undefined && { capacity: values.capacity }),
  ...(values.participationFee !== undefined && { participation_fee: values.participationFee, fee: values.participationFee, fee_type: values.participationFee > 0 ? "paid" : "free" }),
  ...(values.participationType !== undefined && { participation_type: values.participationType }),
  ...(values.recruitmentStatus !== undefined && { recruitment_status: values.recruitmentStatus }),
  ...(values.recruitmentStartAt !== undefined && { recruitment_start_at: values.recruitmentStartAt || null }),
  ...(values.recruitmentEndAt !== undefined && { recruitment_end_at: values.recruitmentEndAt || null }),
  ...(values.targetAudience !== undefined && { target_audience: values.targetAudience || null }),
  ...(values.rules !== undefined && { rules: values.rules || null }),
  ...(values.preparationItems !== undefined && { preparation_items: values.preparationItems || null }),
  ...(values.activityDescription !== undefined && { activity_description: values.activityDescription }),
  ...(values.moodTags !== undefined && { mood_tags: values.moodTags }),
  ...(values.requiredFacilities !== undefined && { required_facilities: values.requiredFacilities }),
  ...(values.indoorOutdoor !== undefined && { indoor_outdoor: values.indoorOutdoor }),
  ...(values.foodDrinkNeeded !== undefined && { food_drink_needed: values.foodDrinkNeeded }),
  ...(values.expectedDurationHours !== undefined && { expected_duration_hours: values.expectedDurationHours }),
  ...(values.budgetMin !== undefined && { budget_min: values.budgetMin }),
  ...(values.budgetMax !== undefined && { budget_max: values.budgetMax }),
  ...(values.travelRange !== undefined && { travel_range: values.travelRange }),
  ...(values.applicationQuestions !== undefined && { application_questions: values.applicationQuestions }),
  ...(values.tags !== undefined && { tags: values.tags }),
  ...(values.linkedSpaceId !== undefined && { linked_space_id: values.linkedSpaceId || null, space_id: values.linkedSpaceId || null }),
  ...(values.meetingFrequencyType !== undefined && { meeting_frequency_type: values.meetingFrequencyType }),
  ...(values.meetingFrequencyLabel !== undefined && { meeting_frequency_label: values.meetingFrequencyLabel || null }),
  ...(values.recommendedFor !== undefined && { recommended_for: values.recommendedFor }),
  ...(values.participationNotices !== undefined && { participation_notices: values.participationNotices }),
  ...(values.durationMinutes !== undefined && { duration_minutes: values.durationMinutes }),
});

async function currentUserId(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  return user.id;
}

function createSlug(name: string) {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "community";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function getPublishedCommunities(db: SupabaseClient) {
  const { data, error } = await db.from("communities").select("*").eq("status", "published").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCommunity);
}
export const getCommunities = getPublishedCommunities;
export const listCommunities = getPublishedCommunities;

export async function getCommunityBySlug(db: SupabaseClient, slug: string) {
  const { data, error } = await db.from("communities").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data ? mapCommunity(data) : null;
}

export async function getMyCommunities(db: SupabaseClient) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("communities").select(ownerSelect).eq("owner_id", ownerId).order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCommunity);
}
export const getCommunitiesForDashboard = getMyCommunities;

export async function getMyCommunityById(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("communities").select(ownerSelect).eq("id", id).eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  return data ? mapCommunity(data) : null;
}
export const getCommunityByIdForDashboard = getMyCommunityById;

export async function getCommunityWithSpace(db: SupabaseClient, slug: string) {
  const community = await getCommunityBySlug(db, slug);
  if (!community) return null;
  if (community.linkedSpaceId) {
    const { getSpaceById } = await import("@/repositories/spaceRepository");
    community.linkedSpace = await getSpaceById(db, community.linkedSpaceId);
  }
  const [hostResult, imagesResult, othersResult] = await Promise.all([
    community.ownerId ? db.rpc("get_public_community_host_profile", { p_user_id: community.ownerId }) : Promise.resolve({ data: [], error: null }),
    db.from("community_activity_images").select("*").eq("community_id", community.id).order("sort_order"),
    community.ownerId ? db.from("communities").select("*").eq("owner_id", community.ownerId).eq("status", "published").neq("id", community.id).limit(3) : Promise.resolve({ data: [], error: null }),
  ]);
  if (hostResult.error) throw hostResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (othersResult.error) throw othersResult.error;
  const hostRow=Array.isArray(hostResult.data)?hostResult.data[0]:hostResult.data;
  if (hostRow) community.hostProfile = mapHostProfile(hostRow);
  community.activityImages = (imagesResult.data ?? []).map(mapActivityImage);
  community.otherHostCommunities = (othersResult.data ?? []).map(mapCommunity);
  return community;
}

function mapHostProfile(row: any): CommunityHostProfile { return { userId:row.user_id,nickname:row.nickname??"회원",profileImage:row.profile_image??null,headline:row.headline,introduction:row.introduction,activityRegion:row.activity_region??null,interestCategories:normalizeCommunityCategories(row.interest_categories??[]),operatingStyles:row.operating_styles??[],startedAt:row.started_at,createdAt:row.created_at,updatedAt:row.updated_at }; }
function mapActivityImage(row: any): CommunityActivityImage { return { id:row.id,communityId:row.community_id,storagePath:row.storage_path,publicUrl:row.public_url,fileName:row.file_name,sortOrder:row.sort_order,createdAt:row.created_at }; }

export async function createCommunityForCurrentUser(db: SupabaseClient, values: CommunityFormValues, status: CommunityStatus) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("communities").insert({
    ...payload(values), owner_id: ownerId, operator_id: null, slug: createSlug(values.name), status,
    recruitment_status: status === "published" ? "recruiting" : "upcoming", thumbnail_url: "/community-placeholder.svg",
    meeting_type: "one-time", fee_type: values.participationFee > 0 ? "paid" : "free",
    fee: values.participationFee, legacy_recruitment_status: status === "published" ? "recruiting" : "upcoming",
    current_members: 0, is_new: true, is_featured: false,
  }).select(ownerSelect).single();
  if (error) throw error;
  return mapCommunity(data);
}
export const createCommunity = createCommunityForCurrentUser;

export async function updateMyCommunity(db: SupabaseClient, id: string, values: Partial<CommunityFormValues>) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("communities").update(payload(values)).eq("id", id).eq("owner_id", ownerId).select(ownerSelect).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("COMMUNITY_NOT_FOUND");
  return mapCommunity(data);
}
export const updateCommunity = updateMyCommunity;

export async function changeCommunityStatus(db: SupabaseClient, id: string, status: CommunityStatus) {
  const community = await getMyCommunityById(db, id);
  if (!community) throw new Error("COMMUNITY_NOT_FOUND");
  if (status === "published") {
    if (!community.name || !community.category || !community.shortDescription || !community.description || !community.mainRegion || !community.detailedRegion || !community.nextMeetingAt || community.capacity < 1) throw new Error("PUBLISH_VALIDATION_FAILED");
    if (community.linkedSpaceId) {
      const { getSpaceById } = await import("@/repositories/spaceRepository");
      const space = await getSpaceById(db, community.linkedSpaceId);
      if (!space || space.status !== "approved") throw new Error("SPACE_NOT_AVAILABLE");
      if (community.capacity > space.maxCapacity) throw new Error("SPACE_CAPACITY_EXCEEDED");
    }
  }
  const { error } = await db.from("communities").update({ status }).eq("id", id).eq("owner_id", community.ownerId);
  if (error) throw error;
}

export async function changeRecruitmentStatus(db: SupabaseClient, id: string, status: RecruitmentStatus) {
  const ownerId = await currentUserId(db);
  const { error } = await db.from("communities").update({ recruitment_status: status, legacy_recruitment_status: status }).eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function uploadCommunityThumbnail(db: SupabaseClient, communityId: string, file: File) {
  const ownerId = await currentUserId(db);
  const community = await getMyCommunityById(db, communityId);
  if (!community) throw new Error("COMMUNITY_NOT_FOUND");
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const path = `${ownerId}/${communityId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await db.storage.from("community-images").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const url = db.storage.from("community-images").getPublicUrl(path).data.publicUrl;
  const update = await db.from("communities").update({ thumbnail_url: url, thumbnail_storage_path: path }).eq("id", communityId).eq("owner_id", ownerId);
  if (update.error) { await db.storage.from("community-images").remove([path]); throw update.error; }
  if (community.thumbnailStoragePath) await db.storage.from("community-images").remove([community.thumbnailStoragePath]);
  return { url, path };
}

export async function uploadCommunityActivityImages(db: SupabaseClient, communityId: string, files: File[]) {
  const ownerId = await currentUserId(db);
  if (!await getMyCommunityById(db, communityId)) throw new Error("COMMUNITY_NOT_FOUND");
  const existing = await db.from("community_activity_images").select("id", { count:"exact", head:true }).eq("community_id", communityId);
  if (existing.error) throw existing.error;
  if ((existing.count ?? 0) + files.length > 8) throw new Error("ACTIVITY_IMAGE_LIMIT");
  const uploaded: string[] = [];
  const rows: Array<Record<string, unknown>> = [];
  try {
    for (let index=0; index<files.length; index++) {
      const file=files[index]; const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
      const path=`${ownerId}/${communityId}/activity/${crypto.randomUUID()}.${ext}`;
      const storage=await db.storage.from("community-images").upload(path,file,{contentType:file.type,upsert:false});
      if(storage.error) throw storage.error; uploaded.push(path);
      const url=db.storage.from("community-images").getPublicUrl(path).data.publicUrl;
      rows.push({community_id:communityId,storage_path:path,public_url:url,file_name:file.name,mime_type:file.type,file_size:file.size,sort_order:(existing.count??0)+index});
    }
    const inserted=await db.from("community_activity_images").insert(rows);
    if(inserted.error) throw inserted.error;
  } catch(error) { if(uploaded.length) await db.storage.from("community-images").remove(uploaded); throw error; }
}

export async function deleteCommunityThumbnail(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const community = await getMyCommunityById(db, id);
  if (!community) return;
  if (community.thumbnailStoragePath) await db.storage.from("community-images").remove([community.thumbnailStoragePath]);
  const { error } = await db.from("communities").update({ thumbnail_url: "/community-placeholder.svg", thumbnail_storage_path: null }).eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}

export async function deleteMyCommunity(db: SupabaseClient, id: string, hard = false) {
  const ownerId = await currentUserId(db);
  const community = await getMyCommunityById(db, id);
  if (!community) return;
  if (!hard) return changeCommunityStatus(db, id, "inactive");
  if (community.thumbnailStoragePath) await db.storage.from("community-images").remove([community.thumbnailStoragePath]);
  const { error } = await db.from("communities").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw error;
}
export const deleteCommunity = deleteMyCommunity;
