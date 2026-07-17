export const OPENAI_VISION_MODEL="gpt-5.4-mini";
export const OPENAI_RECOMMENDATION_MODEL="gpt-5.4-mini";
export const OPENAI_COMMUNITY_DRAFT_MODEL="gpt-5.4-mini";
export const OPENAI_OPERATION_MODEL=process.env.OPENAI_OPERATION_MODEL?.trim()||"gpt-5.4-mini";
export const OPENAI_OPERATION_TIMEOUT_MS=20_000;
export const OPENAI_OPERATION_MAX_OUTPUT_TOKENS=1_800;
export const SPACE_ANALYSIS_TIMEOUT_MS=60_000;
