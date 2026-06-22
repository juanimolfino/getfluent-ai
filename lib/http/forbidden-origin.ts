import { NextResponse } from "next/server";
import { isAllowedRequestOrigin } from "@/lib/http/origin";

export function rejectForbiddenOrigin(request: Request, label: string) {
  if (isAllowedRequestOrigin(request)) return null;
  console.warn(`[origin] rejected endpoint=${label}`);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
