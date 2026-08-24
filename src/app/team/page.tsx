'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TeamDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [team, setTeam] = useState<any>(null);
  const [teamName, setTeamName] = useState('');
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);
      
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('manager_id', session.user.id)
        .single();
        
      if (teamData) {
        setTeam(teamData);
        // fetch players on this team
        const { data: playersData } = await supabase
          .from('players')
          .select('*, profiles(username)')
          .eq('team_id', teamData.id);
        
        if (playersData) setPlayers(playersData);
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data, error } = await supabase
      .from('teams')
      .insert({ manager_id: user.id, name: teamName, budget: 1000 })
      .select()
      .single();
      
    if (data) {
      setTeam(data);
    } else {
      alert("Failed to create team: " + error?.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Team...</div>;

  return (
    <div className="container animate-in">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: 'var(--primary)' }}>My Franchise</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage your squad and budget.</p>
        </div>
        {team && (
          <Link href="/pitch" className="btn btn-primary">Go to Tactical Board</Link>
        )}
      </header>

      {!team ? (
        <div className="glass-panel" style={{ padding: '3rem', maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
          <h3 style={{ marginBottom: '1rem' }}>You don't have a team yet!</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Create your franchise to participate in auctions and draft players.</p>
          <form onSubmit={createTeam} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Enter Team Name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
            />
            <button type="submit" className="btn btn-primary">Create Team & Claim $1000M Budget</button>
          </form>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{team.name}</h2>
            <p style={{ color: 'var(--text-muted)' }}>Manager Dashboard</p>
            <div style={{ marginTop: '2rem', fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)' }}>
              ${team.budget}M
            </div>
            <div style={{ color: 'var(--text-muted)' }}>Remaining Transfer Budget</div>
          </div>

          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Current Roster</h3>
            {players.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>Your squad is empty. Go to the Auction Room to sign players!</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {players.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                    <span style={{ fontWeight: 'bold' }}>{p.profiles?.username}</span>
                    <span style={{ color: 'var(--primary)' }}>{p.primary_position}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
