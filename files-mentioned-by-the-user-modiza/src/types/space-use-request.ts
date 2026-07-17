import type { NegotiationContactMethod } from "@/types/space";

export type SpaceUseRequestStatus =
  | "pending"
  | "negotiating"
  | "approved"
  | "rejected"
  | "confirmed"
  | "cancelled";

export type SpaceUseRequestType = "inquiry" | "request";

export type SpaceUseRequestContact = {
  method: NegotiationContactMethod;
  value: string;
};

export type SpaceUseRequest = {
  id: string;
  spaceId: string;
  communityId: string;
  requesterId: string;
  spaceOwnerId: string;
  purpose: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  expectedAttendees: number;
  message: string | null;
  ownerMemo: string | null;
  memoUpdatedAt: string | null;
  requestType: SpaceUseRequestType;
  status: SpaceUseRequestStatus;
  approvedAt: string | null;
  rejectedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  community: {
    id: string;
    name: string;
    slug: string;
    category: string;
    shortDescription: string;
    thumbnailUrl: string | null;
    capacity: number;
    currentMembers: number;
    hostNickname: string | null;
  } | null;
  space: {
    id: string;
    name: string;
    slug: string;
    address: string;
    addressDetail: string | null;
    thumbnailUrl: string | null;
    communityUseMode: "idle_time_only" | "during_operation" | "request_consultation";
    minimumOrderOrFee: string | null;
    usageRules: string | null;
  } | null;
  contact: SpaceUseRequestContact | null;
};

export type CreateSpaceUseRequestInput = {
  spaceId: string;
  communityId: string;
  purpose: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  expectedAttendees: number;
  message?: string;
  idempotencyKey: string;
};
