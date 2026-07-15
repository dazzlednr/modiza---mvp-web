import{z}from"zod";
export const SpaceAnalysisSchema=z.object({spaceType:z.string(),moods:z.array(z.string()),interiorStyles:z.array(z.string()),visibleFacilities:z.array(z.object({name:z.string(),confidence:z.number().min(0).max(1)})),activities:z.array(z.string()),estimatedCapacity:z.object({min:z.number().int().nonnegative(),max:z.number().int().nonnegative(),confidence:z.number().min(0).max(1)}),description:z.string(),warnings:z.array(z.string())});
export type SpaceAnalysisResult=z.infer<typeof SpaceAnalysisSchema>;
export type StoredSpaceAnalysis={id:string;spaceId:string;analysis:SpaceAnalysisResult;imageSignature:string;model:string;createdAt:string;updatedAt:string};
