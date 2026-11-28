import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string }>) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that do not require authentication
  const publicPaths = ["/planos", "/contato", "/sobre", "/privacidade"];
  const isPublicRoute = publicPaths.some((p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(p + "/"));

  // Redirect unauthenticated users away from protected routes (/dashboard and /admin)
  if (!user && !isPublicRoute && (request.nextUrl.pathname.startsWith("/dashboard") || request.nextUrl.pathname.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect non-admin users away from /admin routes
  if (user && request.nextUrl.pathname.startsWith("/admin")) {
    const { data: admin } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (!admin || admin.length === 0) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/cadastro")
  ) {
    // Check if user has any organizations
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    const hasOrg = !!(memberships && memberships.length > 0);

    const url = request.nextUrl.clone();
    url.pathname = hasOrg ? "/dashboard" : "/dashboard/onboarding";
    return NextResponse.redirect(url);
  }

  // Helper function to check membership using service role key (bypasses RLS)
  async function hasMembershipServiceRole(userId: string): Promise<boolean> {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return false;

    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/memberships?user_id=eq.${userId}&status=eq.active&select=id`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data && data.length > 0;
      }
    } catch (e) {
      console.error('Erro no fallback HTTP do middleware:', e);
    }

    return false;
  }

  // Check membership and set cookie for downstream components
  let hasOrg = false;

  if (user) {
    // Fetch full membership + org data in one query (anon key respects RLS)
    const { data: fullMemberships } = await supabase
      .from("memberships")
      .select("id, organization_id, user_id, role, status, created_at, organizations(id, name, slug, created_by, created_at, updated_at)")
      .eq("user_id", user.id)
      .limit(1);

    hasOrg = !!(fullMemberships && fullMemberships.length > 0 && fullMemberships[0].organizations);

    // If anon key doesn't find anything, try with service role key
    if (!hasOrg) {
      hasOrg = await hasMembershipServiceRole(user.id);
    }

    // Set cookie and pass org data via header so DashboardAuthGate doesn't need to re-query
    if (hasOrg && fullMemberships && fullMemberships.length > 0 && fullMemberships[0].organizations) {
      supabaseResponse.cookies.set('barber_has_org', 'true', {
        path: '/',
        httpOnly: true,
        sameSite: 'lax'
      });

      const m = fullMemberships[0];
      const org = m.organizations!;
      const orgData = {
        org: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          created_by: org.created_by,
          created_at: org.created_at,
          updated_at: org.updated_at,
          membership: {
            id: m.id,
            organization_id: m.organization_id,
            user_id: m.user_id,
            role: m.role,
            status: m.status ?? "active",
            created_at: m.created_at,
          },
        },
        allOrgs: [{
          id: org.id,
          name: org.name,
          slug: org.slug,
          created_by: org.created_by,
          created_at: org.created_at,
          updated_at: org.updated_at,
          membership: {
            id: m.id,
            organization_id: m.organization_id,
            user_id: m.user_id,
            role: m.role,
            status: m.status ?? "active",
            created_at: m.created_at,
          },
        }],
      };
      const encoded = Buffer.from(JSON.stringify(orgData)).toString('base64');
      supabaseResponse.headers.set('x-barber-org-data', encoded);
    }
  }

  if (!hasOrg) {
    supabaseResponse.cookies.delete('barber_has_org');
  }

  // Redirect authenticated users without orgs to onboarding
  if (
    user &&
    request.nextUrl.pathname.startsWith("/dashboard") &&
    request.nextUrl.pathname !== "/dashboard/onboarding" &&
    !hasOrg
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard/onboarding";
    return NextResponse.redirect(url);
  }

  // Redirect users with orgs away from onboarding
  if (user && request.nextUrl.pathname === "/dashboard/onboarding" && hasOrg) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}