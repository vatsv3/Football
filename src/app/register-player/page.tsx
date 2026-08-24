'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Camera, Check, Plus } from 'lucide-react';

const POSITIONS = ['GK', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST'];

export default function RegisterPlayer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [avatarUrl, setAvatarUrl] = useState('');
  const [primaryPos, setPrimaryPos] = useState('ST');
  const [secondaryPos, setSecondaryPos] = useState<string[]>([]);
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [availableTraits, setAvailableTraits] = useState<any[]>([]);

  useEffect(() => {
    const initData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);

      // 1. Fetch profile avatar
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .single();
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }

      // 2. Fetch traits from admin traits table
      const { data: traitsData } = await supabase
        .from('traits')
        .select('*')
        .order('name', { ascending: true });
      if (traitsData) {
        setAvailableTraits(traitsData);
      }

      // 3. Fetch existing player profile if exists
      const { data: player } = await supabase
        .from('players')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (player) {
        if (player.primary_position) setPrimaryPos(player.primary_position);
        if (player.secondary_positions) setSecondaryPos(player.secondary_positions);
        if (player.specialties) setSelectedTraits(player.specialties);
        setMessage({ type: 'info', text: 'You are already registered. You can update your details below.' });
      }

      setLoading(false);
    };
    initData();
  }, [router]);

  const toggleSecondaryPos = (pos: string) => {
    if (pos === primaryPos) return; // cannot be both primary and secondary
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

    // Convert file to Base64 for instant preview & persistence
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
      // Update avatar in profiles table
      if (avatarUrl) {
        await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id);
      }

      // Upsert player details
      const { error } = await supabase.from('players').upsert({
        id: user.id,
        primary_position: primaryPos,
        secondary_positions: secondaryPos,
        specialties: selectedTraits,
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save profile.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading player profile...</div>;
  }

  return (
    <div className="container animate-in" style={{ maxWidth: '650px', marginTop: '2rem', marginBottom: '4rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)', textAlign: 'center' }}>Player Profile Registration</h2>
      
      {message.text && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem', 
          borderRadius: 'var(--radius-sm)',
          backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
          border: `1px solid ${message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6'}`,
          color: message.type === 'error' ? '#ef4444' : message.type === 'success' ? '#10b981' : '#3b82f6'
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Avatar Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '100px', 
            height: '100px', 
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
              <Camera size={36} color="var(--text-muted)" />
            )}
          </div>
          <label className="btn glass-panel" style={{ cursor: 'pointer', fontSize: '0.875rem', padding: '0.5rem 1rem' }}>
            Upload Profile Picture
            <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
          </label>
        </div>

        {/* Primary Position */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>
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

        {/* Secondary Positions Picker (Clickable Badges) */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            Secondary Positions (Click to Select)
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
                    borderRadius: '20px',
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    background: isSelected ? 'rgba(74,222,128,0.2)' : 'rgba(0,0,0,0.2)',
                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 'bold' : 'normal',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isSelected && <Check size={14} />} {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Managed Traits / Specialties */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
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
                      borderRadius: '20px',
                      border: isSelected ? '2px solid var(--secondary)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(59,130,246,0.25)' : 'rgba(0,0,0,0.2)',
                      color: isSelected ? '#60a5fa' : 'white',
                      cursor: 'pointer',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {isSelected && <Check size={14} />} {trait.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }} disabled={submitting}>
          {submitting ? 'Saving Profile...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
