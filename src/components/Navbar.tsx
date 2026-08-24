'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trophy, Users, Shield, LogOut, RefreshCw, Layout, User as UserIcon, Home, DollarSign } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('player');
  const [username, setUsername] = useState<string>('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, username')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setUserRole(profile.role || 'player');
          setUsername(profile.username || '');
        }
      }
    };
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setUserRole('player');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Do not render navbar on auth page
  if (pathname === '/auth') return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  const navLinks = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Players Directory', href: '/players', icon: Users },
    { name: 'My Franchise', href: '/team', icon: Trophy },
    { name: 'Transfer Market', href: '/transfers', icon: RefreshCw },
    { name: 'Auction Room', href: '/auction', icon: DollarSign },
    { name: 'Tactical Pitch', href: '/pitch', icon: Layout },
    { name: 'My Profile', href: '/register-player', icon: UserIcon },
  ];

  if (userRole === 'admin') {
    navLinks.push({ name: 'Admin Panel', href: '/admin', icon: Shield });
  }

  return (
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', marginBottom: '2rem', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.25rem', color: 'var(--primary)' }}>
          <Trophy size={24} /> PRO DRAFT
        </Link>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 'bold' : 'normal',
                  textDecoration: 'none',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(74, 222, 128, 0.15)' : 'transparent',
                  border: isActive ? '1px solid var(--primary)' : '1px solid transparent',
                  transition: 'all 0.2s ease'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--primary)' : 'currentColor'} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* User Badge / Auth */}
        {session ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
              <div style={{ fontWeight: 'bold', color: 'white' }}>{username || session.user.email}</div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: userRole === 'admin' ? '#ef4444' : 'var(--primary)', fontWeight: 'bold' }}>
                {userRole}
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="btn"
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <LogOut size={14} /> Exit
            </button>
          </div>
        ) : (
          <Link href="/auth" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
            Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
