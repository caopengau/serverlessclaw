import { NextRequest, NextResponse } from 'next/server';
import { Resource } from 'sst';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const correctPassword = (Resource as any).DashboardPassword?.value;

    if (password && correctPassword && password === correctPassword) {
      const response = NextResponse.json({ success: true });
      
      // Set a secure, HttpOnly cookie for "authentication"
      // In a real system, this would be a signed JWT or session ID.
      // For this backdoor, we'll use a simple token.
      response.cookies.set('claw_auth_session', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: '/',
      });
      
      return response;
    }

    return NextResponse.json({ error: 'INVALID_CREDENTIALS' }, { status: 401 });
  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json({ error: 'SYSTEM_FAILURE' }, { status: 500 });
  }
}
