import { NextResponse } from "next/server";
import { z } from "zod";
import { apiAuthStatus, requireApiUser } from "@/lib/auth/api";
import { personalizationCategories, personalizationRegions } from "@/constants/personalization";
import { updateProfile } from "@/repositories/profileRepository";

const schema = z.object({
  categories: z.array(z.enum(personalizationCategories)).max(5),
  regions: z.array(z.enum(personalizationRegions)).max(3),
});

export async function PUT(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const { supabase, user } = await requireApiUser();
    const profile = await updateProfile(supabase, user.id, {
      interestedCategories: input.categories,
      interestedRegions: input.regions,
    });
    return NextResponse.json(profile);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof z.ZodError ? "\uAD00\uC2EC\uC0AC \uC120\uD0DD\uC744 \uD655\uC778\uD574 \uC8FC\uC138\uC694." : "\uAD00\uC2EC\uC0AC\uB97C \uC800\uC7A5\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694." },
      { status: apiAuthStatus(error) ?? (error instanceof z.ZodError ? 400 : 500) },
    );
  }
}
