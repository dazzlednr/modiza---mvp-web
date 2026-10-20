import type { SupabaseClient } from "@supabase/supabase-js";
import { assertMeetingReady, canTransitionMeetingStatus } from "@/lib/meeting/validation";
import type { Meeting, MeetingInput, MeetingStatus } from "@/types/meeting";

const meetingSelect = "*,communities(name)";
const publicMeetingSelect = "id,community_id,slug,title,short_description,description,image_url,event_date,start_time,end_time,location,location_is_undecided,capacity,participation_fee,preparation_items,recruitment_start_at,recruitment_end_at,status,visibility,participant_eligibility,created_at,updated_at,communities(name)";

function communityName(row: any) {
  const value = row.communities;
  if (Array.isArray(value)) return value[0]?.name ?? null;
  return value?.name ?? null;
}

export function mapMeeting(row: any): Meeting {
  return {
    id: row.id,
    ownerId: row.owner_id ?? null,
    communityId: row.community_id ?? null,
    sourceMeetingId: row.source_meeting_id ?? null,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    imageUrl: row.image_url ?? null,
    eventDate: row.event_date ?? null,
    startTime: row.start_time?.slice(0, 5) ?? null,
    endTime: row.end_time?.slice(0, 5) ?? null,
    location: row.location ?? null,
    locationIsUndecided: row.location_is_undecided ?? false,
    capacity: row.capacity ?? null,
    participationFee: row.participation_fee ?? 0,
    preparationItems: row.preparation_items ?? "",
    recruitmentStartAt: row.recruitment_start_at ?? null,
    recruitmentEndAt: row.recruitment_end_at ?? null,
    status: row.status,
    visibility: row.visibility,
    participantEligibility: row.participant_eligibility,
    statusChangedAt: row.status_changed_at ?? row.updated_at ?? row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    communityName: communityName(row),
  };
}

function payload(value: MeetingInput) {
  return {
    community_id: value.communityId,
    title: value.title,
    short_description: value.shortDescription,
    description: value.description,
    image_url: value.imageUrl,
    event_date: value.eventDate,
    start_time: value.startTime,
    end_time: value.endTime,
    location: value.location,
    location_is_undecided: value.locationIsUndecided,
    capacity: value.capacity,
    participation_fee: value.participationFee,
    preparation_items: value.preparationItems,
    recruitment_start_at: value.recruitmentStartAt,
    recruitment_end_at: value.recruitmentEndAt,
    visibility: value.visibility,
    participant_eligibility: value.participantEligibility,
  };
}

function createSlug(title: string) {
  const base = title.toLowerCase().trim().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-|-$/g, "") || "meeting";
  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function currentUserId(db: SupabaseClient) {
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("AUTH_REQUIRED");
  return user.id;
}

async function assertOwnedCommunity(db: SupabaseClient, communityId: string | null, ownerId: string) {
  if (!communityId) return;
  const { data, error } = await db.from("communities").select("id").eq("id", communityId).eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("COMMUNITY_NOT_OWNED");
}

export function isMeetingsMigrationPending(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return value.code === "42P01" || value.code === "PGRST205" || Boolean(value.message?.includes("meetings"));
}

export async function listPublicMeetings(db: SupabaseClient) {
  const { data, error } = await db.from("meetings").select(publicMeetingSelect)
    .eq("visibility", "discover")
    .in("status", ["recruiting", "closed"])
    .order("event_date", { ascending: true, nullsFirst: false });
  if (error) {
    if (isMeetingsMigrationPending(error)) return [];
    throw error;
  }
  return (data ?? []).map(mapMeeting);
}

export async function getPublicMeetingBySlug(db: SupabaseClient, slug: string) {
  const { data, error } = await db.from("meetings").select(publicMeetingSelect)
    .eq("slug", slug)
    .in("status", ["recruiting", "closed", "completed"])
    .maybeSingle();
  if (error) {
    if (isMeetingsMigrationPending(error)) return null;
    throw error;
  }
  return data ? mapMeeting(data) : null;
}

export async function getMyMeetings(db: SupabaseClient) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("meetings").select(meetingSelect)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false });
  if (error) {
    if (isMeetingsMigrationPending(error)) return [];
    throw error;
  }
  return (data ?? []).map(mapMeeting);
}

export async function getMyMeetingById(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const { data, error } = await db.from("meetings").select(meetingSelect)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMeeting(data) : null;
}

export async function createMeetingDraft(db: SupabaseClient, value: MeetingInput) {
  const ownerId = await currentUserId(db);
  await assertOwnedCommunity(db, value.communityId, ownerId);
  const { data, error } = await db.from("meetings").insert({
    ...payload(value),
    owner_id: ownerId,
    slug: createSlug(value.title),
    status: "draft",
  }).select(meetingSelect).single();
  if (error) throw error;
  return mapMeeting(data);
}

export async function updateMyMeeting(db: SupabaseClient, id: string, value: MeetingInput) {
  const ownerId = await currentUserId(db);
  await assertOwnedCommunity(db, value.communityId, ownerId);
  const { data, error } = await db.from("meetings").update(payload(value))
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select(meetingSelect)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("MEETING_NOT_FOUND");
  return mapMeeting(data);
}

export async function changeMyMeetingStatus(db: SupabaseClient, id: string, status: MeetingStatus) {
  const ownerId = await currentUserId(db);
  const meeting = await getMyMeetingById(db, id);
  if (!meeting) throw new Error("MEETING_NOT_FOUND");
  if (!canTransitionMeetingStatus(meeting.status, status)) throw new Error("INVALID_MEETING_STATUS_TRANSITION");
  if (status === "recruiting") assertMeetingReady(meeting);
  const { data, error } = await db.from("meetings").update({ status })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select(meetingSelect)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("MEETING_NOT_FOUND");
  return mapMeeting(data);
}

export async function duplicateMyMeeting(db: SupabaseClient, id: string) {
  const ownerId = await currentUserId(db);
  const source = await getMyMeetingById(db, id);
  if (!source) throw new Error("MEETING_NOT_FOUND");
  await assertOwnedCommunity(db, source.communityId, ownerId);
  const { data, error } = await db.from("meetings").insert({
    owner_id: ownerId,
    community_id: source.communityId,
    source_meeting_id: source.id,
    slug: createSlug(`${source.title}-copy`),
    title: `${source.title} 복사본`,
    short_description: source.shortDescription,
    description: source.description,
    image_url: source.imageUrl,
    event_date: null,
    start_time: null,
    end_time: null,
    location: source.location,
    location_is_undecided: source.locationIsUndecided,
    capacity: source.capacity,
    participation_fee: source.participationFee,
    preparation_items: source.preparationItems,
    recruitment_start_at: null,
    recruitment_end_at: null,
    status: "draft",
    visibility: source.visibility,
    participant_eligibility: source.participantEligibility,
  }).select(meetingSelect).single();
  if (error) throw error;
  return mapMeeting(data);
}
