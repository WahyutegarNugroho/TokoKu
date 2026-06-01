import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

const roleRoutes: Record<string, ('OWNER' | 'ADMIN' | 'KASIR')[]> = {
  '/admin': ['OWNER', 'ADMIN'],
  '/categories': ['OWNER', 'ADMIN'],
  '/stores': ['OWNER'],
  '/cashier': ['OWNER', 'ADMIN', 'KASIR'],
  '/onboarding': ['OWNER', 'ADMIN', 'KASIR'],
  '/store-picker': ['OWNER', 'ADMIN', 'KASIR'],
};

const authPrefixes = ['/login', '/register'];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { supabase, response } = createServerSupabaseClient(request);

  const { data: { session } } = await supabase.auth.getSession();
  const isProtected = Object.keys(roleRoutes).some(prefix => pathname.startsWith(prefix));
  const isAuthRoute = authPrefixes.some(prefix => pathname.startsWith(prefix));

  if (!session) {
    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    return response;
  }

  if (isAuthRoute) {
    return NextResponse.redirect(new URL('/cashier', request.url));
  }

  if (isProtected) {
    const { data: membershipData } = await supabase.rpc('get_user_memberships');

    if (!membershipData?.success || !membershipData.memberships?.length) {
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }

    const memberships = membershipData.memberships as Array<{ store_id: string; role: string }>;
    const savedStoreId = request.cookies.get('activeStoreId')?.value;
    const activeMembership = savedStoreId
      ? memberships.find(m => m.store_id === savedStoreId)
      : memberships[0];

    if (!activeMembership) {
      return NextResponse.redirect(new URL('/store-picker', request.url));
    }

    response.cookies.set('activeStoreId', activeMembership.store_id, {
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    const userRole = activeMembership.role as 'OWNER' | 'ADMIN' | 'KASIR';
    const allowedRoles = roleRoutes[Object.keys(roleRoutes).find(prefix => pathname.startsWith(prefix))!] || [];

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL('/cashier', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|images/|audio/|docs/|videos/|.*\\.(?:svg|png|jpg|ico|txt|pdf|json)$).*)'],
};
