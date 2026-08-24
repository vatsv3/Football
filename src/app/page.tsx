'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Users, Activity, LogOut, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setSession(session);
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '6rem', color: 'var(--text-muted)' }}>
        Loading Pro Draft...
      </div>
    );
  }

  return (
    <div className="container animate-in">
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0', borderBottom: '1px solid var(--border)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.25rem' }}>
          <Trophy size={24} /> PRO DRAFT
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{session?.user?.email}</span>
          <button 
            onClick={handleSignOut} 
            className="btn glass-panel" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.875rem', color: '#ef4444', border: '1px solid #ef4444' }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </nav>

      <header style={{ textAlign: 'center', padding: '2rem 0 4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <Trophy size={64} color="var(--primary)" />
        </div>
        <h1 style={{ fontSize: '4rem', marginBottom: '1rem', color: 'var(--primary)' }}>
          PRO DRAFT
        </h1>
        <p style={{ fontSize: '1.25rem', color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto 2.5rem' }}>
          The ultimate real-time football auction simulation. Draft your squad, manage your budget, and build the perfect formation.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/team" className="btn btn-primary" style={{ background: '#eab308' }}>My Franchise</Link>
          <Link href="/transfers" className="btn btn-primary" style={{ background: '#10b981' }}>Transfer Market</Link>
          <Link href="/auction" className="btn btn-primary">Enter Auction Room</Link>
          <Link href="/pitch" className="btn btn-primary" style={{ background: 'var(--secondary)', boxShadow: '0 0 15px rgba(59,130,246,0.4)' }}>Tactical Board</Link>
          <Link href="/register-player" className="btn glass-panel" style={{ color: 'white', textDecoration: 'none' }}>Player Registration</Link>
          <Link href="/admin" className="btn glass-panel" style={{ color: '#ef4444', border: '1px solid #ef4444', textDecoration: 'none' }}>Admin Panel</Link>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Activity size={32} color="var(--primary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Real-time Bidding</h3>
          <p style={{ color: 'var(--text-muted)' }}>Experience the thrill of live auctions with instant WebSocket synchronization.</p>
        </div>
        
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <Users size={32} color="var(--secondary)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>Interactive Pitch</h3>
          <p style={{ color: 'var(--text-muted)' }}>Drag and drop your drafted players into custom formations, from 5-a-side to full 11s.</p>
        </div>
      </section>
    </div>
  );
}
