'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [players, setPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [basePrice, setBasePrice] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setUser(session.user);
        fetchPlayers();
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('players')
      .select('*, profiles(username)')
      .eq('status', 'available');
      
    if (data) {
      setPlayers(data);
      if (data.length > 0) setSelectedPlayer(data[0].id);
    }
  };

  const startAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    
    if (!selectedPlayer) {
      setMessage('Please select a player.');
      return;
    }

    try {
      // Create new live auction
      const timerEndsAt = new Date();
      timerEndsAt.setMinutes(timerEndsAt.getMinutes() + durationMinutes);

      const { error } = await supabase
        .from('auctions')
        .insert({
          player_id: selectedPlayer,
          status: 'live',
          base_price: basePrice,
          current_bid: 0,
          timer_ends_at: timerEndsAt.toISOString()
        });

      if (error) throw error;
      
      setMessage('Auction started successfully! Players will see it live.');
      fetchPlayers(); // refresh list
    } catch (err: any) {
      setMessage('Failed to start auction: ' + err.message);
    }
  };

  const endLiveAuction = async () => {
    setMessage('');
    try {
      // Find the live auction
      const { data: auction } = await supabase.from('auctions').select('*').eq('status', 'live').single();
      if (!auction) throw new Error('No live auction found.');
      
      // Update auction to completed
      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);
      
      // If someone bid, assign player to team and deduct budget
      if (auction.highest_bidder_id) {
        await supabase.from('players').update({ team_id: auction.highest_bidder_id, status: 'drafted' }).eq('id', auction.player_id);
        
        // Deduct budget (ignoring race conditions for MVP)
        const { data: team } = await supabase.from('teams').select('budget').eq('id', auction.highest_bidder_id).single();
        if (team) {
          await supabase.from('teams').update({ budget: team.budget - auction.current_bid }).eq('id', auction.highest_bidder_id);
        }
        setMessage('Auction ended. Player assigned to winning team!');
      } else {
        setMessage('Auction ended with no bids.');
      }
      fetchPlayers();
    } catch (err: any) {
      setMessage('Failed to end auction: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Admin Panel...</div>;

  return (
    <div className="container animate-in">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: 'var(--primary)' }}>Admin Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Configure and launch live auctions.</p>
        </div>
        <button onClick={endLiveAuction} className="btn" style={{ background: '#ef4444', color: 'white' }}>
          Force End Live Auction
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            Start New Auction
          </h3>

          {message && (
            <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>
              {message}
            </div>
          )}

          <form onSubmit={startAuction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Player on the Block</label>
              <select 
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
                required
              >
                <option value="" disabled>-- Select a registered player --</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.profiles?.username} ({p.primary_position})
                  </option>
                ))}
              </select>
              {players.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.5rem' }}>No available players. Ask users to register first.</p>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Base Price (Millions)</label>
              <input 
                type="number"
                min="1"
                value={basePrice}
                onChange={(e) => setBasePrice(Number(e.target.value))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
                required
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Auction Timer (Minutes)</label>
              <input 
                type="number"
                min="1"
                max="60"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={players.length === 0}>
              Start Live Auction
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
            Registered Players Pool
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {players.length === 0 ? (
              <div style={{ color: 'var(--text-muted)' }}>The pool is empty.</div>
            ) : (
              players.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                  <span>{p.profiles?.username}</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.primary_position}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
