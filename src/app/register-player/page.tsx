'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Camera, Check, User, Shield, Trophy, DollarSign } from 'lucide-react';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

export default function RegisterPlayer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('player');
  const [myTeamName, setMyTeamName] = useState<string | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [primaryPos, setPrimaryPos] = useState('ST');
  const [secondaryPos, setSecondaryPos] = useState<string[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [basePriceVal, setBasePriceVal] = useState<number>(10);
  const [availableTraits, setAvailableTraits] = useState<any[]>([]);

  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);

      // 1. Fetch profile (username, avatar, role)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, role')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        if (profile.username) setUsername(profile.username);
        if (profile.avatar_url) setAvatarUrl(profile.avatar_url);
        if (profile.role) setUserRole(profile.role);
      }

      // 2. Fetch traits from admin traits table
      const { data: traitsData } = await supabase
        .from('traits')
        .select('*')
        .order('name', { ascending: true });
      if (traitsData) {
        setAvailableTraits(traitsData);
      }

      // 3. Fetch user's team if manager
      const { data: teamData } = await supabase
        .from('teams')
        .select('name')
        .eq('manager_id', session.user.id)
        .maybeSingle();
      if (teamData?.name) {
        setMyTeamName(teamData.name);
      }

      // 4. Fetch existing player record
      const { data: player } = await supabase
        .from('players')
        .select('*, team:teams(name)')
        .eq('id', session.user.id)
        .maybeSingle();

      if (player) {
        if (player.primary_position) setPrimaryPos(player.primary_position);
        if (player.secondary_positions) setSecondaryPos(player.secondary_positions);
        if (player.specialties) setSelectedTraits(player.specialties);
        if (player.base_price) setBasePriceVal(player.base_price);
        if (player.team?.name) setMyTeamName(player.team.name);
        setMessage({ type: 'info', text: 'You are viewing your Profile. You can update any of your details below.' });
      } else {
        // Create initial default player record
        await supabase.from('players').insert({
          id: session.user.id,
          primary_position: 'ST',
          secondary_positions: [],
          specialties: [],
          base_price: 10,
          status: 'available'
        });
      }

      setLoading(false);
    };
    initData();
  }, [router]);

  const toggleSecondaryPos = (pos: string) => {
    if (pos === primaryPos) return;
    setSecondaryPos(prev => 
      prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]
    );
  };

  const toggleTrait = (traitName: string) => {
    setSelectedTraits(prev => 
      prev.includes(traitName) ? prev.filter(t => t !== traitName) : [...prev, traitName]
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    try {
      // 1. Update username & avatar in profiles table
      if (username.trim()) {
        const { error: profileErr } = await supabase.from('profiles').update({
          username: username.trim(),
          avatar_url: avatarUrl
        }).eq('id', user.id);
        if (profileErr) throw profileErr;
      }

      // 2. Upsert player details
      const { error } = await supabase.from('players').upsert({
        id: user.id,
        primary_position: primaryPos,
        secondary_positions: secondaryPos,
        specialties: selectedTraits,
        base_price: basePriceVal,
        status: 'available'
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading My Profile...</div>;
  }

  return (
    <div className="container animate-in" style={{ maxWidth: '650px', marginTop: '1rem', marginBottom: '4rem' }}>
      <h2 style={{ marginBottom: '1rem', color: 'var(--primary)', textAlign: 'center', fontSize: '2rem' }}>
        My Profile & Settings
      </h2>

      {/* Role & Franchise Info Badge */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
          <Shield size={18} color="var(--primary)" />
          <span>Role: <strong style={{ textTransform: 'uppercase', color: 'var(--primary)' }}>{userRole}</strong></span>
        </div>
        {myTeamName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
            <Trophy size={18} color="#eab308" />
            <span>Franchise: <strong style={{ color: '#eab308' }}>{myTeamName}</strong></span>
          </div>
        )}
      </div>

      {message.text && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem', 
          borderRadius: 'var(--radius-sm)',
          backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
          border: `1px solid ${message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6'}`,
          color: message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6',
          fontSize: '0.9rem'
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        
        {/* Avatar Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '110px', 
            height: '110px', 
            borderRadius: '50%', 
            border: '3px solid var(--primary)', 
            overflow: 'hidden', 
            background: '#1e293b', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            position: 'relative'
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Camera size={40} color="var(--text-muted)" />
            )}
          </div>
          <label className="btn glass-panel" style={{ cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            Change Profile Picture
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Display Name */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
            Player / Display Name
          </label>
          <input
            type="text"
            placeholder="Enter your name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Primary Position */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
            Primary Position
          </label>
          <select 
            value={primaryPos}
            onChange={(e) => {
              const val = e.target.value;
              setPrimaryPos(val);
              setSecondaryPos(prev => prev.filter(p => p !== val));
            }}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          >
            {POSITIONS.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Fixed Base Price */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
            Fixed Base Price ($ Millions)
          </label>
          <input
            type="number"
            min="1"
            value={basePriceVal}
            onChange={(e) => setBasePriceVal(Number(e.target.value))}
            required
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Secondary Positions Picker (Touch-friendly Badges) */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
            Secondary Positions (Tap to Toggle)
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {POSITIONS.filter(p => p !== primaryPos).map(p => {
              const isSelected = secondaryPos.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => toggleSecondaryPos(p)}
                  style={{
                    padding: '0.5rem 1rem',
                    minHeight: '44px',
                    borderRadius: '20px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(74,222,128,0.2)' : 'rgba(0,0,0,0.2)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    transition: 'all 0.2s ease',
                    fontSize: '0.9rem'
                  }}
                >
                  {isSelected && <Check size={16} />} {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Traits & Specialties */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 'bold', color: 'var(--primary)', fontSize: '0.95rem' }}>
            Specialties & Traits
          </label>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            Select from the official traits configured by the Admin.
          </p>

          {availableTraits.length === 0 ? (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>No traits added by Admin yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {availableTraits.map(trait => {
                const isSelected = selectedTraits.includes(trait.name);
                return (
                  <button
                    type="button"
                    key={trait.id}
                    onClick={() => toggleTrait(trait.name)}
                    style={{
                      padding: '0.5rem 1rem',
                      minHeight: '44px',
                      borderRadius: '20px',
                      border: isSelected ? '2px solid var(--secondary)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.2)',
                      color: isSelected ? '#60a5fa' : 'white',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.2s ease',
                      fontSize: '0.9rem'
                    }}
                  >
                    {isSelected && <Check size={16} />} {trait.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', fontSize: '1.1rem' }} disabled={submitting}>
          {submitting ? 'Saving Profile...' : 'Save Profile Changes'}
        </button>
      </form>
    </div>
  );
}
