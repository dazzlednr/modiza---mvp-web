import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateSpaceUseRequestInput,
  SpaceUseRequest,
  SpaceUseRequestContact,
} from "@/types/space-use-request";
import type { CommunityPlaceRequestSummary } from "@/types/community";

const REQUEST_SELECT = `
  *,
  community:communities(id,owner_id,name,slug,category,short_description,thumbnail_url,capacity,current_members),
  space:spaces(id,name,slug,address,address_detail,thumbnail_url,community_use_mode,minimum_order_or_fee,usage_rules)
`;

function map(row: any, contact: SpaceUseRequestContact | null = null, hostNickname: string | null = null): SpaceUseRequest {
  const community = Array.isArray(row.community) ? row.community[0] : row.community;
  const space = Array.isArray(row.space) ? row.space[0] : row.space;
  return {
    id: row.id,
    spaceId: row.space_id,
    communityId: row.community_id,
    requesterId: row.requester_id,
    spaceOwnerId: row.space_owner_id,
    purpose: row.purpose,
    requestedDate: row.requested_date,
    requestedStartTime: row.requested_start_time?.slice(0, 5),
    requestedEndTime: row.requested_end_time?.slice(0, 5),
    expectedAttendees: row.expected_attendees,
    message: row.message,
    ownerMemo: row.owner_memo,
    memoUpdatedAt: row.memo_updated_at ?? null,
    requestType: row.request_type ?? "request",
    status: row.status,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    community: community ? {
      id: community.id,
      name: community.name,
      slug: community.slug,
      category: community.category,
      shortDescription: community.short_description,
      thumbnailUrl: community.thumbnail_url,
      capacity: community.capacity ?? 0,
      currentMembers: community.current_members ?? 0,
      hostNickname,
    } : null,
    space: space ? {
      id: space.id,
      name: space.name,
      slug: space.slug,
      address: space.address,
      addressDetail: space.address_detail,
      thumbnailUrl: space.thumbnail_url,
      communityUseMode: space.community_use_mode ?? "request_consultation",
      minimumOrderOrFee: space.minimum_order_or_fee,
      usageRules: space.usage_rules,
    } : null,
    contact,
  };
}

async function effectiveContact(admin: SupabaseClient, row: any): Promise<SpaceUseRequestContact | null> {
  const publicSpace = await admin.from("spaces")
    .select("negotiation_contact_method,negotiation_contact_value")
    .eq("id", row.space_id)
    .maybeSingle();
  if (publicSpace.error) throw publicSpace.error;
  if (publicSpace.data?.negotiation_contact_method && publicSpace.data?.negotiation_contact_value) {
    return {
      method: publicSpace.data.negotiation_contact_method,
      value: publicSpace.data.negotiation_contact_value,
    };
  }
  const settings = await admin.from("space_contact_settings")
    .select("use_host_contact,contact_method,contact_value")
    .eq("space_id", row.space_id)
    .maybeSingle();
  if (settings.error) throw settings.error;

  if (settings.data && !settings.data.use_host_contact) {
    return settings.data.contact_method && settings.data.contact_value
      ? { method: settings.data.contact_method, value: settings.data.contact_value }
      : null;
  }

  const host = await admin.from("space_host_applications")
    .select("negotiation_contact_method,negotiation_contact_value")
    .eq("user_id", row.space_owner_id)
    .eq("status", "approved")
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (host.error) throw host.error;
  return host.data?.negotiation_contact_method && host.data?.negotiation_contact_value
    ? { method: host.data.negotiation_contact_method, value: host.data.negotiation_contact_value }
    : null;
}

async function rowsWithContact(admin: SupabaseClient, rows: any[], viewerId: string) {
  const ownerIds = [...new Set(rows.map((row) => {
    const community = Array.isArray(row.community) ? row.community[0] : row.community;
    return community?.owner_id as string | undefined;
  }).filter((value): value is string => Boolean(value)))];
  const profiles = ownerIds.length
    ? await admin.from("profiles").select("id,nickname").in("id", ownerIds)
    : { data: [], error: null };
  if (profiles.error) throw profiles.error;
  const nicknames = new Map((profiles.data ?? []).map((profile) => [profile.id, profile.nickname]));
  return Promise.all(rows.map(async (row) => map(
    row,
    row.requester_id === viewerId || row.space_owner_id === viewerId
      ? await effectiveContact(admin, row)
      : null,
    nicknames.get((Array.isArray(row.community) ? row.community[0] : row.community)?.owner_id) ?? null,
  )));
}

export async function getSpaceUseRequest(
  admin: SupabaseClient,
  id: string,
  viewerId: string,
) {
  const { data, error } = await admin.from("space_use_requests")
    .select(REQUEST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.requester_id !== viewerId && data.space_owner_id !== viewerId)) return null;
  const community = Array.isArray(data.community) ? data.community[0] : data.community;
  const profile = community?.owner_id
    ? await admin.from("profiles").select("nickname").eq("id", community.owner_id).maybeSingle()
    : { data: null, error: null };
  if (profile.error) throw profile.error;
  return map(data, await effectiveContact(admin, data), profile.data?.nickname ?? null);
}

export async function getRequestsForSpaceOwner(admin: SupabaseClient, ownerId: string) {
  const { data, error } = await admin.from("space_use_requests")
    .select(REQUEST_SELECT)
    .eq("space_owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return rowsWithContact(admin, data ?? [], ownerId);
}

export async function getRequestsForCommunityOwner(admin: SupabaseClient, requesterId: string) {
  const { data, error } = await admin.from("space_use_requests")
    .select(REQUEST_SELECT)
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return rowsWithContact(admin, data ?? [], requesterId);
}

export async function getLatestRequestByCommunity(admin: SupabaseClient, requesterId: string) {
  const { data, error } = await admin.from("space_use_requests")
    .select("id,community_id,space_id,status,request_type,requested_date,requested_start_time,requested_end_time,created_at,space:spaces(slug,name)")
    .eq("requester_id", requesterId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const result = new Map<string, CommunityPlaceRequestSummary>();
  for (const row of data ?? []) {
    if (result.has(row.community_id)) continue;
    const space = Array.isArray(row.space) ? row.space[0] : row.space;
    result.set(row.community_id, {
      id: row.id,
      spaceId: row.space_id,
      spaceSlug: space?.slug ?? null,
      spaceName: space?.name ?? null,
      status: row.status,
      requestType: row.request_type ?? "request",
      requestedDate: row.requested_date,
      requestedStartTime: row.requested_start_time?.slice(0, 5),
      requestedEndTime: row.requested_end_time?.slice(0, 5),
    });
  }
  return result;
}

export async function createSpaceUseRequest(
  db: SupabaseClient,
  input: CreateSpaceUseRequestInput,
) {
  const { data, error } = await db.rpc("create_space_use_request", {
    p_space_id: input.spaceId,
    p_community_id: input.communityId,
    p_purpose: input.purpose,
    p_requested_date: input.requestedDate,
    p_requested_start_time: input.requestedStartTime,
    p_requested_end_time: input.requestedEndTime,
    p_expected_attendees: input.expectedAttendees,
    p_message: input.message || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw error;
  return data;
}

export async function respondToSpaceUseRequest(
  db: SupabaseClient,
  id: string,
  status: "negotiating" | "approved" | "rejected",
  ownerMemo?: string,
) {
  const { data, error } = await db.rpc("respond_space_use_request", {
    p_request_id: id,
    p_status: status,
    p_owner_memo: ownerMemo || null,
  });
  if (error) throw error;
  return data;
}

export async function updateSpaceUseRequestMemo(
  db: SupabaseClient,
  id: string,
  ownerMemo?: string,
) {
  const { data, error } = await db.rpc("update_space_use_request_memo", {
    p_request_id: id,
    p_owner_memo: ownerMemo || null,
  });
  if (error) throw error;
  return data;
}

export async function confirmSpaceUseRequest(db: SupabaseClient, id: string) {
  const { data, error } = await db.rpc("confirm_space_use_request", {
    p_request_id: id,
  });
  if (error) throw error;
  return data;
}
