import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase with Service Role Key to bypass RLS and create users
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password, username, primary_position, secondary_positions, specialties } = body;

    // Check if service role key is configured
    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Server missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    // 1. Create User in Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto confirm so they can login immediately
      user_metadata: { username }
    });

    if (authError) throw authError;

    const userId = authData.user.id;

    // 2. Wait for trigger to create profile, then update role
    // (The database trigger handles inserting into public.profiles automatically)
    // We can just sleep for a second to ensure trigger finished
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await supabaseAdmin.from('profiles').update({ role: 'player' }).eq('id', userId);

    // 3. Create Player record
    const { error: playerError } = await supabaseAdmin.from('players').insert({
      id: userId,
      primary_position,
      secondary_positions: secondary_positions || [],
      specialties: specialties || [],
      status: 'available'
    });

    if (playerError) throw playerError;

    return NextResponse.json({ success: true, user: authData.user });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
