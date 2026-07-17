import type { Space } from "@/types/space";

export type PublicSpaceDetail = Pick<
  Space,
  | "id"
  | "slug"
  | "name"
  | "spaceType"
  | "shortDescription"
  | "description"
  | "mainRegion"
  | "detailedRegion"
  | "customRegion"
  | "address"
  | "addressDetail"
  | "pricePerHour"
  | "minimumHours"
  | "minCapacity"
  | "suitableCapacity"
  | "maxCapacity"
  | "availableDays"
  | "availableStartTime"
  | "availableEndTime"
  | "regularUseAvailable"
  | "usesDaySpecificHours"
  | "operatingHours"
  | "communityUseMode"
  | "communityAvailability"
  | "communityRecurrenceType"
  | "communityAvailabilityStartDate"
  | "communityAvailabilityEndDate"
  | "communitySpecificDates"
  | "minimumOrderOrFee"
  | "additionalUseConditions"
  | "preferredContactMethod"
  | "privateContact"
  | "usageRules"
  | "difficultActivities"
  | "facilities"
  | "moods"
  | "suitableActivities"
  | "noiseLevel"
  | "foodAllowed"
  | "alcoholAllowed"
  | "furnitureMovable"
  | "parkingAvailable"
  | "thumbnailUrl"
  | "images"
  | "analysisUpdatedAt"
>;

export function toPublicSpaceDetail(space: Space): PublicSpaceDetail {
  const {
    id, slug, name, spaceType, shortDescription, description,
    mainRegion, detailedRegion, customRegion, address, addressDetail,
    pricePerHour, minimumHours, minCapacity, suitableCapacity, maxCapacity,
    availableDays, availableStartTime, availableEndTime, regularUseAvailable,
    usesDaySpecificHours, operatingHours, communityUseMode, communityAvailability,
    communityRecurrenceType, communityAvailabilityStartDate,
    communityAvailabilityEndDate, communitySpecificDates, minimumOrderOrFee,
    additionalUseConditions, preferredContactMethod, privateContact, usageRules, difficultActivities,
    facilities, moods, suitableActivities, noiseLevel, foodAllowed,
    alcoholAllowed, furnitureMovable, parkingAvailable, thumbnailUrl,
    images, analysisUpdatedAt,
  } = space;

  return {
    id, slug, name, spaceType, shortDescription, description,
    mainRegion, detailedRegion, customRegion, address, addressDetail,
    pricePerHour, minimumHours, minCapacity, suitableCapacity, maxCapacity,
    availableDays, availableStartTime, availableEndTime, regularUseAvailable,
    usesDaySpecificHours, operatingHours, communityUseMode, communityAvailability,
    communityRecurrenceType, communityAvailabilityStartDate,
    communityAvailabilityEndDate, communitySpecificDates, minimumOrderOrFee,
    additionalUseConditions, preferredContactMethod, privateContact, usageRules, difficultActivities,
    facilities, moods, suitableActivities, noiseLevel, foodAllowed,
    alcoholAllowed, furnitureMovable, parkingAvailable, thumbnailUrl,
    images, analysisUpdatedAt,
  };
}
