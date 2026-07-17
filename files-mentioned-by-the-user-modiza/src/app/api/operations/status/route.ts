import { NextResponse } from "next/server";
import { operationAiEnabled } from "@/lib/operations/server";
export async function GET(){return NextResponse.json({enabled:operationAiEnabled()});}
