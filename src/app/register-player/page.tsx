'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function RegisterPlayer() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [primaryPos, setPrimaryPos] = useState('ST');
  const [secondaryPos, setSecondaryPos] = useState('');
  const [specialties, setSpecialties] = useState('');

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setUser(session.user);
        
        // Check if player profile already exists
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (data) {
          setPrimaryPos(data.primary_position);
          setSecondaryPos(data.secondary_positions?.join(', ') || '');
          setSpecialties(data.specialties?.join(', ') || '');
          setMessage({ type: 'info', text: 'You are already registered. You can update your details below.' });
        }
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });

    const secArr = secondaryPos.split(',').map(s => s.trim()).filter(Boolean);
    const specArr = specialties.split(',').map(s => s.trim()).filter(Boolean);

    try {
      const { error } = await supabase.from('players').upsert({
        id: user.id,
        primary_position: primaryPos,
        secondary_positions: secArr,
        specialties: specArr,
      });

      if (error) throw error;
      setMessage({ type: 'success', text: 'Registration saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save registration.' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading...</div>;
  }

  return (
    <div className="container animate-in" style={{ maxWidth: '600px', marginTop: '2rem' }}>
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary)' }}>Player Registration</h2>
      
      {message.text && (
        <div style={{ 
          padding: '1rem', 
          marginBottom: '1.5rem', 
          borderRadius: 'var(--radius-sm)',
          backgroundColor: message.type === 'error' ? 'rgba(239,68,68,0.1)' : message.type === 'success' ? 'rgba(74,222,128,0.1)' : 'rgba(59,130,246,0.1)',
          border: `1px solid ${message.type === 'error' ? '#ef4444' : message.type === 'success' ? 'var(--primary)' : '#3b82f6'}`,
          color: message.type === 'error' ? '#ef4444' : message.type === 'success' ? 'var(--primary)' : '#3b82f6'
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="glass-panel" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Primary Position</label>
          <select 
            value={primaryPos}
            onChange={(e) => setPrimaryPos(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          >
            <option value="GK">Goalkeeper (GK)</option>
            <option value="CB">Center Back (CB)</option>
            <option value="LB">Left Back (LB)</option>
            <option value="RB">Right Back (RB)</option>
            <option value="CDM">Central Defensive Midfielder (CDM)</option>
            <option value="CM">Central Midfielder (CM)</option>
            <option value="CAM">Central Attacking Midfielder (CAM)</option>
            <option value="LW">Left Winger (LW)</option>
            <option value="RW">Right Winger (RW)</option>
            <option value="ST">Striker (ST)</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Secondary Positions (comma separated)</label>
          <input 
            type="text"
            placeholder="e.g. RW, CAM"
            value={secondaryPos}
            onChange={(e) => setSecondaryPos(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-muted)' }}>Specialties (comma separated)</label>
          <input 
            type="text"
            placeholder="e.g. Free Kicks, Speed, Playmaker"
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--border)' }}
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
