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
    console.log('🔍 Middleware: verificando organização para usuário', user.id);

    // First try with anon key (respects RLS)
    const { data: memberships, error } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .limit(1);

    console.log('📊 Resultado da query anon:', { memberships, error });
    hasOrg = !!(memberships && memberships.length > 0);

    // If anon key doesn't find anything, try with service role key
    if (!hasOrg) {
      console.log('⚠️ Anon não encontrou, tentando service role...');
      hasOrg = await hasMembershipServiceRole(user.id);
      console.log('✅ Resultado service role:', hasOrg);
    }
  }

  // Set cookie to signal to downstream components that user has org
  if (hasOrg) {
    supabaseResponse.cookies.set('barber_has_org', 'true', {
      path: '/',
      httpOnly: true,
      sameSite: 'lax'
    });
  } else {
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