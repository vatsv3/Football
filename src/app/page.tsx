'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Users, Activity, Shield, RefreshCw, Layout, User, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', marginTop: '6rem', color: 'var(--text-muted)' }}>
        Loading Pro Draft...
      </div>
    );
  }

  return (
    <div className="container animate-in">
      <header style={{ textAlign: 'center', padding: '2rem 0 3rem' }}>
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
          <Link href="/players" className="btn btn-primary" style={{ background: '#3b82f6' }}>Players Directory</Link>
          <Link href="/team" className="btn btn-primary" style={{ background: '#eab308' }}>My Franchise</Link>
          <Link href="/transfers" className="btn btn-primary" style={{ background: '#10b981' }}>Transfer Market</Link>
          <Link href="/auction" className="btn btn-primary">Enter Auction Room</Link>
          <Link href="/pitch" className="btn btn-primary" style={{ background: 'var(--secondary)', boxShadow: '0 0 15px rgba(59,130,246,0.4)' }}>Tactical Board</Link>
          <Link href="/register-player" className="btn glass-panel" style={{ color: 'white', textDecoration: 'none' }}>Player Registration</Link>
          <Link href="/admin" className="btn glass-panel" style={{ color: '#ef4444', border: '1px solid #ef4444', textDecoration: 'none' }}>Admin Panel</Link>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginTop: '2rem', marginBottom: '4rem' }}>
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
