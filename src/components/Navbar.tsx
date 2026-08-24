'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Trophy, Users, Shield, LogOut, RefreshCw, Layout, User as UserIcon, Home, DollarSign, Menu, X } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('player');
  const [username, setUsername] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

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

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    <header className="glass-panel" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none', marginBottom: '1.5rem', position: 'sticky', top: 0, zIndex: 100 }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1.25rem' }}>
        
        {/* Brand Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--primary)' }}>
          <Trophy size={24} /> PRO DRAFT
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="desktop-nav" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
                  padding: '0.5rem 0.75rem',
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

        {/* Desktop User Info & Sign Out */}
        <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {session ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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

        {/* Mobile Hamburger Toggle Button */}
        <button
          className="mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            padding: '0.5rem'
          }}
        >
          {mobileMenuOpen ? <X size={26} color="var(--primary)" /> : <Menu size={26} color="white" />}
        </button>

      </div>

      {/* Mobile Navigation Menu Drawer */}
      {mobileMenuOpen && (
        <div 
          className="animate-in"
          style={{
            background: 'rgba(15, 17, 21, 0.98)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid var(--border)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          {session && (
            <div style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', color: 'white', fontSize: '0.95rem' }}>{username || session.user.email}</div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: userRole === 'admin' ? '#ef4444' : 'var(--primary)', fontWeight: 'bold' }}>
                  {userRole}
                </span>
              </div>
              <button
                onClick={handleSignOut}
                className="btn"
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid #ef4444' }}
              >
                <LogOut size={14} /> Exit
              </button>
            </div>
          )}

          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '1rem',
                  fontWeight: isActive ? 'bold' : 'normal',
                  textDecoration: 'none',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(74, 222, 128, 0.2)' : 'rgba(255,255,255,0.03)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid transparent'
                }}
              >
                <Icon size={20} color={isActive ? 'var(--primary)' : 'currentColor'} />
                {link.name}
              </Link>
            );
          })}
        </div>
      )}

      {/* Inline style overrides for mobile vs desktop navigation display */}
      <style jsx>{`
        @media (max-width: 900px) {
          .desktop-nav {
            display: none !important;
          }
          .mobile-toggle {
            display: block !important;
          }
        }
      `}</style>
    </header>
  );
}
