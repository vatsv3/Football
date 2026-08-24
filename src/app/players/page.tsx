'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Search, User, Shield, CheckCircle, Tag, Filter } from 'lucide-react';

export default function PlayersDirectory() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPosFilter, setSelectedPosFilter] = useState('ALL');

  useEffect(() => {
    const fetchPlayers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }

      // Fetch all players with profile info & assigned team info
      const { data, error } = await supabase
        .from('players')
        .select(`
          *,
          profiles (username, avatar_url, role),
          team:teams (id, name)
        `)
        .order('primary_position', { ascending: true });

      if (data) {
        setPlayers(data);
      }
      setLoading(false);
    };

    fetchPlayers();
  }, [router]);

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '5rem' }}>Loading Players Directory...</div>;
  }

  // Filtering Logic
  const filteredPlayers = players.filter(p => {
    const username = p.profiles?.username || '';
    const traits = p.specialties || [];
    const matchesSearch = username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      traits.some((t: string) => t.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;

    if (selectedPosFilter === 'ALL') return true;
    if (selectedPosFilter === 'GK') return p.primary_position === 'GK';
    if (selectedPosFilter === 'DEF') return ['CB', 'LB', 'RB'].includes(p.primary_position);
    if (selectedPosFilter === 'MID') return ['CM', 'CDM', 'CAM'].includes(p.primary_position);
    if (selectedPosFilter === 'FWD') return ['ST', 'LW', 'RW'].includes(p.primary_position);

    return true;
  });

  return (
    <div className="container animate-in" style={{ marginBottom: '4rem' }}>
      <header style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ color: 'var(--primary)', fontSize: '2rem', marginBottom: '0.5rem' }}>Players Directory</h2>
        <p style={{ color: 'var(--text-muted)' }}>Explore all registered players, their positions, specialties, and team contracts.</p>
      </header>

      {/* Search and Filters */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem', alignItems: 'center' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search by player name or trait..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem 1rem 0.75rem 2.75rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(0,0,0,0.3)',
              color: 'white',
              border: '1px solid var(--border)',
              fontSize: '0.95rem'
            }}
          />
        </div>

        {/* Position Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { label: 'All', value: 'ALL' },
            { label: 'GK', value: 'GK' },
            { label: 'Defenders', value: 'DEF' },
            { label: 'Midfielders', value: 'MID' },
            { label: 'Attackers', value: 'FWD' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setSelectedPosFilter(f.value)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '20px',
                border: selectedPosFilter === f.value ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: selectedPosFilter === f.value ? 'rgba(74,222,128,0.2)' : 'rgba(0,0,0,0.2)',
                color: selectedPosFilter === f.value ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: selectedPosFilter === f.value ? 'bold' : 'normal',
                transition: 'all 0.2s ease'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Players Cards Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          No players found matching your criteria.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredPlayers.map(p => (
            <div 
              key={p.id} 
              className="glass-panel" 
              style={{ 
                padding: '1.5rem', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '1rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.2s ease, border-color 0.2s ease'
              }}
            >
              {/* Header: Photo & Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '2px solid var(--primary)',
                  overflow: 'hidden',
                  background: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {p.profiles?.avatar_url ? (
                    <img src={p.profiles.avatar_url} alt={p.profiles.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={30} color="var(--text-muted)" />
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: '1.2rem', margin: 0, color: 'white' }}>
                    {p.profiles?.username || 'Unknown Player'}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <span style={{ 
                      padding: '0.2rem 0.6rem', 
                      borderRadius: '4px', 
                      background: 'var(--primary)', 
                      color: 'black', 
                      fontWeight: 'bold', 
                      fontSize: '0.75rem' 
                    }}>
                      {p.primary_position}
                    </span>
                    
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: p.status === 'drafted' ? '#ef4444' : '#10b981',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {p.status === 'drafted' ? (p.team?.name ? `Drafted (${p.team.name})` : 'Drafted') : 'Available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Secondary Positions */}
              {p.secondary_positions && p.secondary_positions.length > 0 && (
                <div style={{ fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Secondary Pos: </span>
                  <span style={{ color: 'white', fontWeight: '500' }}>{p.secondary_positions.join(', ')}</span>
                </div>
              )}

              {/* Traits / Specialties Pills */}
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Tag size={12} /> Traits & Specialties:
                </div>
                {p.specialties && p.specialties.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {p.specialties.map((trait: string, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          padding: '0.2rem 0.6rem',
                          borderRadius: '12px',
                          background: 'rgba(59,130,246,0.2)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59,130,246,0.4)',
                          fontSize: '0.75rem'
                        }}
                      >
                        {trait}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', italic: 'true' }}>No traits assigned</span>
                )}
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
