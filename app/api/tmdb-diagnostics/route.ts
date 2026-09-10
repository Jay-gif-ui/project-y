import { NextResponse } from "next/server";
import { diagnoseCollections } from "@/lib/tmdb";

export const dynamic = "force-dynamic";

export async function GET(){return NextResponse.json({checks:await diagnoseCollections()},{headers:{"Cache-Control":"no-store"}})}
