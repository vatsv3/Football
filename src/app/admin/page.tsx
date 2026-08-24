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

  // New Player Registration State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPrimaryPos, setNewPrimaryPos] = useState('ST');
  const [regMessage, setRegMessage] = useState('');

  // Edit Player State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPos, setEditPos] = useState('');
  const [editStatus, setEditStatus] = useState('');

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
      .order('status', { ascending: false });
      
    if (data) {
      setPlayers(data);
      const available = data.filter(p => p.status === 'available');
      if (available.length > 0) setSelectedPlayer(available[0].id);
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
      fetchPlayers(); 
    } catch (err: any) {
      setMessage('Failed to start auction: ' + err.message);
    }
  };

  const endLiveAuction = async () => {
    setMessage('');
    try {
      const { data: auction } = await supabase.from('auctions').select('*').eq('status', 'live').single();
      if (!auction) throw new Error('No live auction found.');
      
      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);
      
      if (auction.highest_bidder_id) {
        await supabase.from('players').update({ team_id: auction.highest_bidder_id, status: 'drafted' }).eq('id', auction.player_id);
        
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

  const handleRegisterPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegMessage('Registering...');
    try {
      const res = await fetch('/api/admin/create-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          username: newUsername,
          primary_position: newPrimaryPos
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');
      
      setRegMessage('Player successfully registered!');
      setNewEmail(''); setNewPassword(''); setNewUsername('');
      fetchPlayers();
    } catch (err: any) {
      setRegMessage('Error: ' + err.message);
    }
  };

  const startEditing = (p: any) => {
    setEditingId(p.id);
    setEditPos(p.primary_position);
    setEditStatus(p.status);
  };

  const saveEdit = async (id: string) => {
    try {
      await supabase.from('players').update({
        primary_position: editPos,
        status: editStatus
      }).eq('id', id);
      setEditingId(null);
      fetchPlayers();
    } catch (err: any) {
      alert("Error saving: " + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Admin Panel...</div>;

  const availablePlayers = players.filter(p => p.status === 'available');

  return (
    <div className="container animate-in">
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: 'var(--primary)' }}>Admin Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Configure auctions, register and manage players.</p>
        </div>
        <button onClick={endLiveAuction} className="btn" style={{ background: '#ef4444', color: 'white' }}>
          Force End Live Auction
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
        {/* Start Auction Panel */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Start New Auction</h3>
          {message && <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>{message}</div>}
          <form onSubmit={startAuction} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Select Player on the Block</label>
              <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} required>
                <option value="" disabled>-- Select a registered player --</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.profiles?.username} ({p.primary_position})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Base Price (Millions)</label>
              <input type="number" min="1" value={basePrice} onChange={(e) => setBasePrice(Number(e.target.value))} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} required />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Auction Timer (Minutes)</label>
              <input type="number" min="1" max="60" value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={availablePlayers.length === 0}>Start Live Auction</button>
          </form>
        </div>

        {/* Register New Player Panel */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Register New Player</h3>
          {regMessage && <div style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: 'var(--radius-sm)' }}>{regMessage}</div>}
          <form onSubmit={handleRegisterPlayer} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input type="email" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} />
            <input type="password" placeholder="Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} />
            <input type="text" placeholder="Username / Player Name" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }} />
            <select value={newPrimaryPos} onChange={(e) => setNewPrimaryPos(e.target.value)} required style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}>
              <option value="GK">GK - Goalkeeper</option>
              <option value="CB">CB - Center Back</option>
              <option value="LB">LB - Left Back</option>
              <option value="RB">RB - Right Back</option>
              <option value="CM">CM - Central Midfield</option>
              <option value="CAM">CAM - Attacking Midfield</option>
              <option value="LW">LW - Left Wing</option>
              <option value="RW">RW - Right Wing</option>
              <option value="ST">ST - Striker</option>
            </select>
            <button type="submit" className="btn" style={{ background: 'white', color: 'black' }}>Register Player</button>
          </form>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
            Note: This requires the Service Role Key to be set in your Vercel Environment Variables.
          </p>
        </div>
      </div>

      {/* Player Management List */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>All Registered Players</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {players.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>The pool is empty.</div>
          ) : (
            players.map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ minWidth: '150px' }}>{p.profiles?.username}</span>
                
                {editingId === p.id ? (
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <select value={editPos} onChange={e => setEditPos(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: '#333', color: 'white', border: 'none' }}>
                      <option value="GK">GK</option>
                      <option value="CB">CB</option>
                      <option value="LB">LB</option>
                      <option value="RB">RB</option>
                      <option value="CM">CM</option>
                      <option value="CAM">CAM</option>
                      <option value="LW">LW</option>
                      <option value="RW">RW</option>
                      <option value="ST">ST</option>
                    </select>
                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px', background: '#333', color: 'white', border: 'none' }}>
                      <option value="available">Available</option>
                      <option value="drafted">Drafted</option>
                    </select>
                    <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => saveEdit(p.id)}>Save</button>
                    <button className="btn" style={{ padding: '0.5rem 1rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.primary_position}</span>
                    <span style={{ color: p.status === 'available' ? '#10b981' : '#ef4444' }}>{p.status}</span>
                    <button className="btn" style={{ background: '#3b82f6', color: 'white', padding: '0.5rem 1rem' }} onClick={() => startEditing(p)}>Edit</button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
