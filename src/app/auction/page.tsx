'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, Clock, DollarSign, PlusCircle, CheckCircle2, User, AlertCircle, Play } from 'lucide-react';

export default function AuctionRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);

  const [auction, setAuction] = useState<any>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [biddingMsg, setBiddingMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Host New Auction State
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [basePrice, setBasePrice] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(5);
  const [hostMsg, setHostMsg] = useState('');
  const [startingAuction, setStartingAuction] = useState(false);

  useEffect(() => {
    const checkAuthAndTeam = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);

      // Fetch user's team if they have one
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('manager_id', session.user.id)
        .single();
      if (teamData) setMyTeam(teamData);

      setLoading(false);
    };
    checkAuthAndTeam();
  }, [router]);

  // Fetch available players for starting an auction
  const fetchAvailablePlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*, profiles(username, avatar_url)')
      .eq('status', 'available');
    if (data) {
      setAvailablePlayers(data);
      if (data.length > 0) setSelectedPlayerId(data[0].id);
    }
  };

  useEffect(() => {
    fetchLiveAuction();
    fetchAvailablePlayers();

    // Subscribe to realtime updates on auctions table
    const auctionChannel = supabase.channel('public:auctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, (payload) => {
        const newRow = payload.new as any;
        if (newRow?.status === 'live') {
          fetchLiveAuction();
          fetchAvailablePlayers();
        } else if (newRow?.status === 'completed') {
          setAuction(null);
          fetchAvailablePlayers();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
    };
  }, []);

  const fetchLiveAuction = async () => {
    const { data } = await supabase
      .from('auctions')
      .select(`
        *,
        player:players(id, primary_position, secondary_positions, specialties, profiles(username, avatar_url)),
        highest_bidder:teams!highest_bidder_id(id, name)
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setAuction(data);
      const minBid = Number(data.current_bid || 0) > 0 
        ? Number(data.current_bid) + 5 
        : Number(data.base_price);
      setBidAmount(minBid);
    } else {
      setAuction(null);
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (!auction?.timer_ends_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(auction.timer_ends_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setTimeLeft('00:00 - TIME EXPIRED');
        clearInterval(interval);
      } else {
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction?.timer_ends_at]);

  // Host New Auction Handler
  const handleHostAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) {
      setHostMsg('Please select a player.');
      return;
    }

    setStartingAuction(true);
    setHostMsg('');

    try {
      const timerEndsAt = new Date();
      timerEndsAt.setMinutes(timerEndsAt.getMinutes() + durationMinutes);

      const { error } = await supabase
        .from('auctions')
        .insert({
          player_id: selectedPlayerId,
          status: 'live',
          base_price: basePrice,
          current_bid: 0,
          timer_ends_at: timerEndsAt.toISOString()
        });

      if (error) throw error;

      setHostMsg('Auction successfully launched!');
      setShowHostPanel(false);
      fetchLiveAuction();
      fetchAvailablePlayers();
    } catch (err: any) {
      setHostMsg('Error starting auction: ' + err.message);
    } finally {
      setStartingAuction(false);
    }
  };

  // Place Bid Handler
  const placeBid = async () => {
    setBiddingMsg({ type: '', text: '' });
    if (!auction) return;
    if (!myTeam) {
      setBiddingMsg({ type: 'error', text: 'You must create a Franchise Team first to place bids! Go to "My Franchise".' });
      return;
    }

    const currentHighest = Number(auction.current_bid || 0);
    const base = Number(auction.base_price || 0);

    if (currentHighest > 0 && bidAmount <= currentHighest) {
      setBiddingMsg({ type: 'error', text: `Bid must be higher than current bid ($${currentHighest}M)` });
      return;
    }
    if (currentHighest === 0 && bidAmount < base) {
      setBiddingMsg({ type: 'error', text: `Bid must be at least the base price ($${base}M)` });
      return;
    }

    if (bidAmount > myTeam.budget) {
      setBiddingMsg({ type: 'error', text: `Insufficient budget! Your team budget is $${myTeam.budget}M.` });
      return;
    }

    try {
      const { error } = await supabase
        .from('auctions')
        .update({
          current_bid: bidAmount,
          highest_bidder_id: myTeam.id
        })
        .eq('id', auction.id);

      if (error) throw error;

      setBiddingMsg({ type: 'success', text: `Bid of $${bidAmount}M placed successfully!` });
      fetchLiveAuction();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: 'Failed to place bid: ' + err.message });
    }
  };

  // End Auction Handler
  const finishAuction = async () => {
    if (!auction) return;
    try {
      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);

      if (auction.highest_bidder_id) {
        // Assign player to team
        await supabase.from('players').update({ team_id: auction.highest_bidder_id, status: 'drafted' }).eq('id', auction.player_id);

        // Deduct budget
        const { data: team } = await supabase.from('teams').select('budget').eq('id', auction.highest_bidder_id).single();
        if (team) {
          await supabase.from('teams').update({ budget: team.budget - auction.current_bid }).eq('id', auction.highest_bidder_id);
        }
        alert('Auction completed! Player signed to the winning team!');
      } else {
        alert('Auction completed with no bids.');
      }
      setAuction(null);
      fetchAvailablePlayers();
    } catch (err: any) {
      alert('Error finalizing auction: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Auction Room...</div>;

  return (
    <div className="container animate-in" style={{ marginBottom: '4rem' }}>
      {/* Header & Controls */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', fontSize: '2rem', margin: 0 }}>Live Auction Room</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Real-time synchronized bidding for registered players.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {myTeam && (
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Franchise: </span>
              <span style={{ color: '#eab308', fontWeight: 'bold' }}>{myTeam.name}</span> (${myTeam.budget}M)
            </div>
          )}

          <button 
            onClick={() => {
              setShowHostPanel(!showHostPanel);
              fetchAvailablePlayers();
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={18} /> {showHostPanel ? 'Close Host Panel' : 'Host / Start Auction'}
          </button>
        </div>
      </header>

      {/* Host New Auction Config Panel */}
      {showHostPanel && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={20} /> Configure & Launch New Auction
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Select an available registered player and configure the base price and timer settings.
          </p>

          {hostMsg && (
            <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>
              {hostMsg}
            </div>
          )}

          <form onSubmit={handleHostAuction} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Select Player on Block</label>
              <select 
                value={selectedPlayerId} 
                onChange={e => setSelectedPlayerId(e.target.value)} 
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              >
                <option value="" disabled>-- Select Available Player --</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.profiles?.username} ({p.primary_position})</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Base Price ($ Millions)</label>
              <input 
                type="number" 
                min="1" 
                value={basePrice} 
                onChange={e => setBasePrice(Number(e.target.value))} 
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Timer Duration (Minutes)</label>
              <input 
                type="number" 
                min="1" 
                max="60" 
                value={durationMinutes} 
                onChange={e => setDurationMinutes(Number(e.target.value))} 
                required 
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={startingAuction || availablePlayers.length === 0} 
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {startingAuction ? 'Launching...' : 'Start Live Auction'}
            </button>
          </form>
        </div>
      )}

      {/* Main Live Auction Block */}
      {!auction ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <Clock size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>No Active Live Auction</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Click the <strong>"Host / Start Auction"</strong> button above to pick a player and launch the bidding!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
          
          {/* Active Player Card & Bidding */}
          <div className="glass-panel" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
            
            {/* Live Badge & Countdown Timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '2rem', alignItems: 'center' }}>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}>
                ● LIVE BIDDING
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#eab308', fontWeight: 'bold', fontSize: '1.1rem' }}>
                <Clock size={20} /> {timeLeft || 'Calculating time...'}
              </div>
            </div>

            {/* Player Avatar */}
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
              marginBottom: '1rem'
            }}>
              {auction.player?.profiles?.avatar_url ? (
                <img src={auction.player.profiles.avatar_url} alt="Player Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={48} color="var(--text-muted)" />
              )}
            </div>

            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', color: 'white' }}>
              {auction.player?.profiles?.username || 'Player on Block'}
            </h1>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ background: 'var(--primary)', color: 'black', padding: '0.25rem 0.8rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
                {auction.player?.primary_position}
              </span>
              {auction.player?.specialties && auction.player.specialties.map((spec: string, i: number) => (
                <span key={i} style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', padding: '0.25rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
                  {spec}
                </span>
              ))}
            </div>

            <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Current Highest Bid</div>
            <div style={{ fontSize: '4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '0.5rem' }}>
              ${auction.current_bid || auction.base_price}M
            </div>

            {auction.highest_bidder?.name ? (
              <div style={{ fontSize: '0.9rem', color: '#eab308', marginBottom: '2rem' }}>
                Held by <strong>{auction.highest_bidder.name}</strong>
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Base Price: ${auction.base_price}M (No bids placed yet)
              </div>
            )}

            {/* Bidding Controls */}
            {biddingMsg.text && (
              <div style={{
                padding: '0.75rem 1rem',
                marginBottom: '1.5rem',
                borderRadius: 'var(--radius-sm)',
                background: biddingMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                color: biddingMsg.type === 'error' ? '#ef4444' : '#10b981',
                border: `1px solid ${biddingMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
                fontSize: '0.9rem',
                width: '100%',
                maxWidth: '450px'
              }}>
                {biddingMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '450px' }}>
              <input 
                type="number" 
                value={bidAmount} 
                onChange={e => setBidAmount(Number(e.target.value))}
                style={{ flex: 1, padding: '1rem', fontSize: '1.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid var(--border)', textAlign: 'center' }}
              />
              <button onClick={placeBid} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.25rem', fontWeight: 'bold' }}>
                PLACE BID
              </button>
            </div>

          </div>

          {/* Sidebar Info & Host End Control */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', margin: 0 }}>Auction Summary</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Base Price:</span> ${auction.base_price}M</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Current High:</span> ${auction.current_bid || auction.base_price}M</div>
              <div><span style={{ color: 'var(--text-muted)' }}>High Bidder:</span> {auction.highest_bidder?.name || 'None'}</div>
            </div>

            <button 
              onClick={finishAuction} 
              className="btn" 
              style={{ background: '#ef4444', color: 'white', marginTop: 'auto', padding: '0.75rem' }}
            >
              Finish & Assign Winner
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
