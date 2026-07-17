import type { NegotiationContactMethod } from "@/types/space";
export type HostApplicationStatus="pending"|"approved"|"rejected";
export type SpaceHostApplication={id:string;userId:string;applicantName:string;email:string;phone:string;spaceName:string;spaceAddress:string;spaceType:string;relationship:string;relatedLink:string|null;message:string|null;evidencePath:string|null;evidencePaths:string[];negotiationContactMethod:NegotiationContactMethod|null;negotiationContactValue:string|null;status:HostApplicationStatus;rejectionReason:string|null;reviewedBy:string|null;reviewedAt:string|null;createdAt:string;updatedAt:string};
export type AdminStats={members:number;pendingHosts:number;spaces:number;communities:number;pendingReports:number};
export type AdminMember={id:string;email:string;nickname:string;roles:string[];accountStatus:"active"|"suspended";communityHostRevokedAt:string|null;communityHostRevocationReason:string|null;createdAt:string};
export type AdminAudit={id:string;adminId:string;actionType:string;targetType:string;targetId:string|null;reason:string|null;createdAt:string};
