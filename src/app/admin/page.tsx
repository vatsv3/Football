'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, Shield, User, Edit3, X, Tag } from 'lucide-react';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [players, setPlayers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [basePrice, setBasePrice] = useState(10);
  const [durationMinutes, setDurationMinutes] = useState(5);
  const [message, setMessage] = useState('');

  // New Player Registration State
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPrimaryPos, setNewPrimaryPos] = useState('ST');
  const [newBasePriceVal, setNewBasePriceVal] = useState(10);
  const [regMessage, setRegMessage] = useState('');

  // Traits Management State
  const [traits, setTraits] = useState<any[]>([]);
  const [newTraitName, setNewTraitName] = useState('');
  const [traitMsg, setTraitMsg] = useState('');

  // Full Edit Modal / Form State
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [editPrimaryPos, setEditPrimaryPos] = useState('ST');
  const [editSecondaryPos, setEditSecondaryPos] = useState<string[]>([]);
  const [editTraits, setEditTraits] = useState<string[]>([]);
  const [editBasePriceVal, setEditBasePriceVal] = useState<number>(10);
  const [editStatus, setEditStatus] = useState('available');
  const [editTeamId, setEditTeamId] = useState('');
  const [editMsg, setEditMsg] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setUser(session.user);
        fetchPlayers();
        fetchTeams();
        fetchTraits();
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  const fetchPlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*, profiles(username, avatar_url), team:teams(id, name)')
      .order('status', { ascending: false });
      
    if (data) {
      setPlayers(data);
      const available = data.filter(p => p.status === 'available');
      if (available.length > 0) setSelectedPlayer(available[0].id);
    }
  };

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name', { ascending: true });
    if (data) setTeams(data);
  };

  const fetchTraits = async () => {
    const { data } = await supabase.from('traits').select('*').order('name', { ascending: true });
    if (data) setTraits(data);
  };

  const handleAddTrait = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTraitName.trim()) return;
    setTraitMsg('');

    try {
      const { error } = await supabase.from('traits').insert({ name: newTraitName.trim() });
      if (error) throw error;
      setNewTraitName('');
      setTraitMsg('Trait added successfully!');
      fetchTraits();
    } catch (err: any) {
      setTraitMsg('Error: ' + err.message);
    }
  };

  const handleDeleteTrait = async (id: string) => {
    try {
      await supabase.from('traits').delete().eq('id', id);
      fetchTraits();
    } catch (err: any) {
      alert('Failed to delete trait: ' + err.message);
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

  // Open Edit Player Modal / Drawer
  const openPlayerEditor = (p: any) => {
    setEditingPlayer(p);
    setEditUsername(p.profiles?.username || '');
    setEditAvatarUrl(p.profiles?.avatar_url || '');
    setEditPrimaryPos(p.primary_position || 'ST');
    setEditSecondaryPos(p.secondary_positions || []);
    setEditTraits(p.specialties || []);
    setEditBasePriceVal(p.base_price || 10);
    setEditStatus(p.status || 'available');
    setEditTeamId(p.team_id || '');
    setEditMsg('');
  };

  const toggleEditSecondaryPos = (pos: string) => {
    if (pos === editPrimaryPos) return;
    setEditSecondaryPos(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const toggleEditTrait = (traitName: string) => {
    setEditTraits(prev => 
      prev.includes(traitName) ? prev.filter(t => t !== traitName) : [...prev, traitName]
    );
  };

  const savePlayerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    setEditMsg('Saving changes...');

    try {
      // 1. Update Profile (Username & Avatar)
      await supabase.from('profiles').update({
        username: editUsername,
        avatar_url: editAvatarUrl
      }).eq('id', editingPlayer.id);

      // 2. Update Player Details
      await supabase.from('players').update({
        primary_position: editPrimaryPos,
        secondary_positions: editSecondaryPos,
        specialties: editTraits,
        base_price: editBasePriceVal,
        status: editStatus,
        team_id: editTeamId || null
      }).eq('id', editingPlayer.id);

      setEditMsg('Player updated successfully!');
      setTimeout(() => {
        setEditingPlayer(null);
        fetchPlayers();
      }, 800);
    } catch (err: any) {
      setEditMsg('Error: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Admin Panel...</div>;

  const availablePlayers = players.filter(p => p.status === 'available');

  return (
    <div className="container animate-in" style={{ marginBottom: '4rem' }}>
      <header style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '2rem' }}>
            <Shield size={32} /> Admin Dashboard & Full Control
          </h2>
          <p style={{ color: 'var(--text-muted)' }}>Configure auctions, manage player profiles, traits, teams, and database records.</p>
        </div>
        <button onClick={endLiveAuction} className="btn" style={{ background: '#ef4444', color: 'white' }}>
          Force End Live Auction
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        
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
              {POSITIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button type="submit" className="btn" style={{ background: 'white', color: 'black' }}>Register Player</button>
          </form>
        </div>

        {/* Global Trait Manager */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Global Trait Manager</h3>
          {traitMsg && <div style={{ padding: '0.75rem', marginBottom: '1rem', backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>{traitMsg}</div>}
          
          <form onSubmit={handleAddTrait} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <input 
              type="text" 
              placeholder="New Trait (e.g. Speedster)" 
              value={newTraitName} 
              onChange={e => setNewTraitName(e.target.value)}
              style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
            />
            <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Plus size={16} /> Add
            </button>
          </form>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {traits.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No traits available.</p>
            ) : (
              traits.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.8rem', background: 'rgba(255,255,255,0.08)', borderRadius: '20px', border: '1px solid var(--border)', fontSize: '0.875rem' }}>
                  <span>{t.name}</span>
                  <button 
                    onClick={() => handleDeleteTrait(t.id)} 
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Comprehensive All Player Profiles Section */}
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <h3 style={{ margin: 0, color: 'var(--primary)' }}>All Registered Player Profiles ({players.length})</h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Admin Full Edit Rights Enabled</span>
        </div>

        {players.length === 0 ? (
          <div style={{ color: 'var(--text-muted)' }}>No players registered in database.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {players.map(p => (
              <div 
                key={p.id} 
                style={{ 
                  background: 'rgba(0,0,0,0.3)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 'var(--radius-sm)', 
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative'
                }}
              >
                {/* Header: Photo & Name & Edit Button */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                      width: '50px',
                      height: '50px',
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
                        <User size={24} color="var(--text-muted)" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'white' }}>
                        {p.profiles?.username || 'Unnamed'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Status: <span style={{ color: p.status === 'drafted' ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>{p.status}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openPlayerEditor(p)}
                    className="btn"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '0.4rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Edit3 size={14} /> Edit
                  </button>
                </div>

                {/* Details */}
                <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Primary Pos: </span>
                    <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{p.primary_position}</span>
                  </div>

                  {p.secondary_positions && p.secondary_positions.length > 0 && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Secondary Pos: </span>
                      <span>{p.secondary_positions.join(', ')}</span>
                    </div>
                  )}

                  {p.team?.name && (
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Team: </span>
                      <span style={{ color: '#eab308', fontWeight: 'bold' }}>{p.team.name}</span>
                    </div>
                  )}

                  {p.specialties && p.specialties.length > 0 && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Traits:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {p.specialties.map((t: string, idx: number) => (
                          <span key={idx} style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', fontSize: '0.75rem' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 200,
          padding: '1rem'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '600px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, color: 'var(--primary)' }}>Admin Edit Player: {editingPlayer.profiles?.username}</h3>
              <button onClick={() => setEditingPlayer(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {editMsg && (
              <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
                {editMsg}
              </div>
            )}

            <form onSubmit={savePlayerEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Username */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Username / Player Name</label>
                <input type="text" value={editUsername} onChange={e => setEditUsername(e.target.value)} required style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }} />
              </div>

              {/* Avatar URL */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Avatar / Photo URL</label>
                <input type="text" value={editAvatarUrl} onChange={e => setEditAvatarUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }} />
              </div>

              {/* Primary Position */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Primary Position</label>
                <select value={editPrimaryPos} onChange={e => setEditPrimaryPos(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}>
                  {POSITIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Fixed Base Price */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Fixed Base Price ($ Millions)</label>
                <input 
                  type="number" 
                  min="1" 
                  value={editBasePriceVal} 
                  onChange={e => setEditBasePriceVal(Number(e.target.value))} 
                  required 
                  style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }} 
                />
              </div>

              {/* Secondary Positions Picker */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Secondary Positions</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {POSITIONS.filter(p => p !== editPrimaryPos).map(p => {
                    const isSel = editSecondaryPos.includes(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() => toggleEditSecondaryPos(p)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '16px',
                          border: isSel ? '1px solid var(--primary)' : '1px solid var(--border)',
                          background: isSel ? 'rgba(74,222,128,0.2)' : 'transparent',
                          color: isSel ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {isSel && <Check size={12} />} {p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Traits Picker */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Traits / Specialties</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {traits.map(t => {
                    const isSel = editTraits.includes(t.name);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleEditTrait(t.name)}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '16px',
                          border: isSel ? '1px solid var(--secondary)' : '1px solid var(--border)',
                          background: isSel ? 'rgba(59,130,246,0.2)' : 'transparent',
                          color: isSel ? '#60a5fa' : 'var(--text-muted)',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        {isSel && <Check size={12} />} {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status & Team */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Status</label>
                  <select value={editStatus} onChange={e => setEditStatus(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}>
                    <option value="available">Available</option>
                    <option value="drafted">Drafted</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Assigned Team</label>
                  <select value={editTeamId} onChange={e => setEditTeamId(e.target.value)} style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}>
                    <option value="">-- Unassigned --</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setEditingPlayer(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
