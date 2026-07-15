export type ScheduleStatus="upcoming"|"completed"|"cancelled";
export type Schedule={id:string;communityId?:string|null;title:string;communityName:string;date:string;startTime:string;endTime?:string;location:string;description?:string;capacity?:number;status:ScheduleStatus;createdAt:string;updatedAt:string};
export type ChecklistItem={id:string;title:string;completed:boolean;dueDate?:string;createdAt:string;updatedAt:string};
export type ChecklistGroup={id:string;communityId?:string|null;title:string;order:number;items:ChecklistItem[]};
export type ApplicationStatus="pending"|"approved"|"rejected";
export type CommunityApplication={id:string;applicantName:string;communityName:string;appliedAt:string;introduction:string;motivation:string;status:ApplicationStatus;operatorMemo?:string};
