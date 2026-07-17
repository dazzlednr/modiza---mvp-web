export type SpaceStatus =
  | "draft"
  | "pending"
  | "revision_requested"
  | "approved"
  | "rejected"
  | "suspended"
  | "inactive";

export type NoiseLevel = "quiet" | "moderate" | "active";
export type SpaceRelationshipType = "owner" | "employee" | "manager" | "tenant" | "other";
export type SpaceVerificationStatus = "pending" | "revision_requested" | "approved" | "rejected" | "cancelled";
export type CommunityUseMode = "idle_time_only" | "during_operation" | "request_consultation";
export type CommunityRecurrenceType = "weekly" | "date_range" | "specific_dates";
export type NegotiationContactMethod =
  | "store_phone"
  | "kakao_open_chat"
  | "kakao_channel"
  | "instagram"
  | "other";

export type SpaceOperatingHour = {
  id?: string;
  spaceId?: string;
  dayOfWeek: number;
  isOpen: boolean;
  startTime?: string | null;
  endTime?: string | null;
  hasBreak: boolean;
  breakStartTime?: string | null;
  breakEndTime?: string | null;
};

export type SpaceCommunityAvailability = {
  id?: string;
  spaceId?: string;
  dayOfWeek: number;
  startTime?: string | null;
  endTime?: string | null;
};

export type SpaceVerificationRequest = {
  id: string;
  spaceId: string;
  applicantId: string;
  status: SpaceVerificationStatus;
  contactName: string;
  contactPhone: string;
  relationshipType: SpaceRelationshipType;
  relationshipDetail?: string | null;
  applicantNote?: string | null;
  revisionRequestReason?: string | null;
  rejectionReason?: string | null;
  submittedAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpaceImage = {
  id: string;
  spaceId: string;
  storagePath: string;
  publicUrl: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  sortOrder: number;
  isThumbnail: boolean;
  createdAt: string;
};

export type Space = {
  id: string;
  ownerId?: string | null;
  operatorId?: string | null;
  name: string;
  slug: string;
  spaceType: string;
  shortDescription?: string | null;
  description?: string | null;
  mainRegion: string;
  detailedRegion?: string | null;
  customRegion?: string | null;
  address: string;
  addressDetail?: string | null;
  postalCode?: string | null;
  roadAddress?: string | null;
  jibunAddress?: string | null;
  buildingName?: string | null;
  addressSido?: string | null;
  addressSigungu?: string | null;
  addressDong?: string | null;
  pricePerHour: number;
  minimumHours: number;
  minCapacity: number;
  suitableCapacity?: number | null;
  maxCapacity: number;
  availableDays: string[];
  availableStartTime?: string | null;
  availableEndTime?: string | null;
  usesDaySpecificHours: boolean;
  operatingHours: SpaceOperatingHour[];
  communityUseMode: CommunityUseMode;
  communityAvailability: SpaceCommunityAvailability[];
  communityAvailabilityAutoSync: boolean;
  communityRecurrenceType: CommunityRecurrenceType;
  communityAvailabilityStartDate?: string | null;
  communityAvailabilityEndDate?: string | null;
  communitySpecificDates: string[];
  minimumOrderOrFee?: string | null;
  additionalUseConditions?: string | null;
  useHostContact: boolean;
  preferredContactMethod?: NegotiationContactMethod | null;
  privateContact?: string | null;
  usageRules?: string | null;
  difficultActivities: string[];
  regularUseAvailable: boolean;
  facilities: string[];
  moods: string[];
  suitableActivities: string[];
  noiseLevel: NoiseLevel;
  foodAllowed: boolean;
  alcoholAllowed: boolean;
  furnitureMovable: boolean;
  parkingAvailable: boolean;
  thumbnailUrl?: string | null;
  status: SpaceStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  relationshipType?: SpaceRelationshipType | null;
  relationshipDetail?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  suspendedAt?: string | null;
  suspensionReason?: string | null;
  latestVerification?: SpaceVerificationRequest | null;
  images: SpaceImage[];
  analysisUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SpaceFormValues = Omit<
  Space,
  | "id"
  | "ownerId"
  | "operatorId"
  | "slug"
  | "thumbnailUrl"
  | "images"
  | "analysisUpdatedAt"
  | "latestVerification"
  | "approvedAt"
  | "approvedBy"
  | "suspendedAt"
  | "suspensionReason"
  | "contactName"
  | "contactPhone"
  | "relationshipType"
  | "relationshipDetail"
  | "createdAt"
  | "updatedAt"
>;

export type CreateSpaceInput = SpaceFormValues;
export type UpdateSpaceInput = Partial<SpaceFormValues>;
