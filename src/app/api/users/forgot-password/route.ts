import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', email.toLowerCase())
      .single();

    if (user) {
      // Store password reset request
      await supabase
        .from('password_reset_requests')
        .insert([
          {
            user_id: user.id,
            email: user.email,
            status: 'pending',
          },
        ]);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ success: true }); // Don't expose errors
  }
}
