import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

export async function GET(request) {
  const key = process.env.FINHAUS_WP_API_KEY;

  if (!key) {
    return NextResponse.json(
      { success: false, message: "FINHAUS_WP_API_KEY is not configured in Vercel." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!validDate(from) || !validDate(to)) {
    return NextResponse.json(
      { success: false, message: "Invalid from/to date." },
      { status: 400 }
    );
  }

  const base = process.env.FINHAUS_WP_API_URL ||
    "https://finhaus.lt/wp-json/finhaus/v1/submissions";

  const url = new URL(base);
  url.searchParams.set("key", key);
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    const text = await response.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { success: false, message: "WordPress returned a non-JSON response." },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          message: data?.message || "WordPress API request failed.",
          upstreamStatus: response.status
        },
        { status: 502 }
      );
    }

    const headers = new Headers();
    headers.set("Cache-Control", "no-store, max-age=0");

    return NextResponse.json(data, { headers });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: "Could not reach Finhaus WordPress API." },
      { status: 502 }
    );
  }
}
