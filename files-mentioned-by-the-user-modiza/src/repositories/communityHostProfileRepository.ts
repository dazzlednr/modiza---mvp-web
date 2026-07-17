import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCommunityCategories } from "@/constants/taxonomy";
import type { CommunityHostProfile } from "@/types/community";

export type CommunityHostProfileInput = Pick<CommunityHostProfile,"headline"|"introduction"|"activityRegion"|"interestCategories"|"operatingStyles">;

function map(row: any): CommunityHostProfile { return { userId:row.user_id,nickname:row.nickname??"회원",profileImage:row.profile_image??null,headline:row.headline,introduction:row.introduction,activityRegion:row.activity_region??null,interestCategories:normalizeCommunityCategories(row.interest_categories??[]),operatingStyles:row.operating_styles??[],startedAt:row.started_at,createdAt:row.created_at,updatedAt:row.updated_at }; }

export async function getCommunityHostProfile(db:SupabaseClient,userId:string) {
  const result=await db.rpc("get_public_community_host_profile",{p_user_id:userId});
  if(result.error) throw result.error; const row=Array.isArray(result.data)?result.data[0]:result.data; return row?map(row):null;
}

export async function startCommunityHost(db:SupabaseClient,values:CommunityHostProfileInput) {
  const result=await db.rpc("start_community_host",{p_headline:values.headline,p_introduction:values.introduction,p_activity_region:values.activityRegion,p_interest_categories:values.interestCategories,p_operating_styles:values.operatingStyles});
  if(result.error) throw result.error; const row=Array.isArray(result.data)?result.data[0]:result.data; if(!row) throw new Error("PROFILE_NOT_FOUND"); return map(row);
}

export async function updateCommunityHostProfile(db:SupabaseClient,userId:string,values:CommunityHostProfileInput) {
  const result=await db.from("community_host_profiles").update({headline:values.headline,introduction:values.introduction,activity_region:values.activityRegion||null,interest_categories:values.interestCategories,operating_styles:values.operatingStyles}).eq("user_id",userId);
  if(result.error) throw result.error; const profile=await getCommunityHostProfile(db,userId); if(!profile)throw new Error("PROFILE_NOT_FOUND"); return profile;
}
