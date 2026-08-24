'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, Clock, DollarSign, PlusCircle, User, Play, ChevronRight, Zap, CheckCircle, Shield } from 'lucide-react';

export default function AuctionRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);

  const [auction, setAuction] = useState<any>(null);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [biddingMsg, setBiddingMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);

  // Host Auction Queue State
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number>(20);
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

      // Fetch user's team
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('manager_id', session.user.id)
        .single();
      if (teamData) setMyTeam(teamData);

      fetchTeams();
      setLoading(false);
    };
    checkAuthAndTeam();
  }, [router]);

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name', { ascending: true });
    if (data) setAllTeams(data);
  };

  const fetchAvailablePlayers = async () => {
    const { data } = await supabase
      .from('players')
      .select('*, profiles(username, avatar_url)')
      .eq('status', 'available');
    if (data) {
      setAvailablePlayers(data);
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
        } else if (newRow?.status === 'completed') {
          setAuction(null);
          fetchAvailablePlayers();
          fetchTeams();
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
        player:players(id, primary_position, secondary_positions, specialties, base_price, profiles(username, avatar_url)),
        highest_bidder:teams!highest_bidder_id(id, name)
      `)
      .eq('status', 'live')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setAuction(data);
    } else {
      setAuction(null);
    }
  };

  // Real-time Timer Countdown & Auto-Advance Effect
  useEffect(() => {
    if (!auction?.timer_ends_at) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(auction.timer_ends_at).getTime();
      const diff = Math.max(0, Math.floor((end - now) / 1000));

      setTimeLeftSeconds(diff);

      if (diff <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction?.timer_ends_at]);

  // Launch Live Auction for Selected Player or Queue
  const handleLaunchAuction = async (playerIdToLaunch?: string) => {
    const targetPlayerId = playerIdToLaunch || (selectedPlayerIds.length > 0 ? selectedPlayerIds[0] : availablePlayers[0]?.id);
    if (!targetPlayerId) {
      setHostMsg('No available player selected.');
      return;
    }

    setStartingAuction(true);
    setHostMsg('');

    try {
      // Fetch fixed base price of selected player
      const { data: pData } = await supabase.from('players').select('base_price').eq('id', targetPlayerId).single();
      const playerBasePrice = Number(pData?.base_price || 10);

      const timerEndsAt = new Date();
      timerEndsAt.setSeconds(timerEndsAt.getSeconds() + timerDurationSeconds);

      const { error } = await supabase
        .from('auctions')
        .insert({
          player_id: targetPlayerId,
          status: 'live',
          base_price: playerBasePrice,
          current_bid: 0,
          timer_ends_at: timerEndsAt.toISOString()
        });

      if (error) throw error;

      setHostMsg('Auction successfully launched!');
      setShowHostPanel(false);
      fetchLiveAuction();
    } catch (err: any) {
      setHostMsg('Error starting auction: ' + err.message);
    } finally {
      setStartingAuction(false);
    }
  };

  // Quick-Bid Handler (Resets Timer & Increases Bid)
  const placeQuickBid = async (increment: number) => {
    setBiddingMsg({ type: '', text: '' });
    if (!auction) return;
    if (!myTeam) {
      setBiddingMsg({ type: 'error', text: 'You must create a Franchise Team first! Go to "My Franchise".' });
      return;
    }

    const currentBid = Number(auction.current_bid || 0);
    const fixedBase = Number(auction.player?.base_price || auction.base_price || 10);
    
    // Calculate new bid amount
    let newBid = 0;
    if (currentBid === 0) {
      newBid = fixedBase + increment;
    } else {
      newBid = currentBid + increment;
    }

    if (newBid > myTeam.budget) {
      setBiddingMsg({ type: 'error', text: `Insufficient budget! Your team budget is $${myTeam.budget}M.` });
      return;
    }

    try {
      // Reset timer on new bid (PlayAuctionGame style: add 15s to give others a chance)
      const newTimerEnds = new Date();
      newTimerEnds.setSeconds(newTimerEnds.getSeconds() + 15);

      const { error } = await supabase
        .from('auctions')
        .update({
          current_bid: newBid,
          highest_bidder_id: myTeam.id,
          timer_ends_at: newTimerEnds.toISOString()
        })
        .eq('id', auction.id);

      if (error) throw error;

      setBiddingMsg({ type: 'success', text: `Placed bid of $${newBid}M! Timer reset +15s.` });
      fetchLiveAuction();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: 'Failed to place bid: ' + err.message });
    }
  };

  // Finalize / Next Player Handler
  const finishCurrentAuctionAndAdvance = async () => {
    if (!auction) return;
    try {
      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);

      if (auction.highest_bidder_id) {
        // Assign player to winning team
        await supabase.from('players').update({ team_id: auction.highest_bidder_id, status: 'drafted' }).eq('id', auction.player_id);

        // Deduct budget
        const { data: team } = await supabase.from('teams').select('budget').eq('id', auction.highest_bidder_id).single();
        if (team) {
          await supabase.from('teams').update({ budget: team.budget - auction.current_bid }).eq('id', auction.highest_bidder_id);
        }
      }

      setAuction(null);
      fetchAvailablePlayers();
      fetchTeams();

      // Check if there are remaining queued players to auto-launch next!
      const { data: nextAvailable } = await supabase.from('players').select('id').eq('status', 'available').limit(1);
      if (nextAvailable && nextAvailable.length > 0) {
        handleLaunchAuction(nextAvailable[0].id);
      }
    } catch (err: any) {
      alert('Error finalizing auction: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading PlayAuction Game Room...</div>;

  const currentBidDisplay = Number(auction?.current_bid || 0);
  const fixedBasePrice = Number(auction?.player?.base_price || auction?.base_price || 10);

  return (
    <div className="container animate-in" style={{ marginBottom: '4rem' }}>
      
      {/* Top Bar */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', fontSize: '2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap color="var(--primary)" size={28} /> Live Auction Arena
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>PlayAuctionGame-style real-time bidding & fixed base prices.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {myTeam ? (
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', border: '1px solid var(--primary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Franchise: </span>
              <span style={{ color: '#eab308', fontWeight: 'bold' }}>{myTeam.name}</span> (${myTeam.budget}M)
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: '#ef4444' }}>Create a Team in "My Franchise" to bid!</div>
          )}

          <button 
            onClick={() => {
              setShowHostPanel(!showHostPanel);
              fetchAvailablePlayers();
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={18} /> {showHostPanel ? 'Close Host Panel' : 'Host / Setup Queue'}
          </button>
        </div>
      </header>

      {/* Host Setup & Queue Panel */}
      {showHostPanel && (
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={20} /> Host Auction Controls
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Select a registered player to put on the block. Each player's base price is fixed by the host.
          </p>

          {hostMsg && <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>{hostMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Select Player on Block</label>
              <select 
                value={selectedPlayerIds[0] || ''} 
                onChange={e => setSelectedPlayerIds([e.target.value])} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              >
                <option value="" disabled>-- Select Available Player --</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.profiles?.username} ({p.primary_position}) - Fixed Base: ${p.base_price || 10}M</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Initial Timer Window (Seconds)</label>
              <input 
                type="number" 
                min="10" 
                max="120" 
                value={timerDurationSeconds} 
                onChange={e => setTimerDurationSeconds(Number(e.target.value))} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              />
            </div>

            <button 
              onClick={() => handleLaunchAuction()} 
              className="btn btn-primary" 
              disabled={startingAuction || availablePlayers.length === 0} 
              style={{ padding: '0.75rem 1.5rem' }}
            >
              {startingAuction ? 'Launching...' : 'Launch Bidding Block'}
            </button>
          </div>
        </div>
      )}

      {/* Main Arena Layout */}
      {!auction ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <Clock size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>No Active Live Auction</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Click <strong>"Host / Setup Queue"</strong> above to launch a registered player onto the bidding block!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '2rem' }}>
          
          {/* Active Bidding Box */}
          <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
            
            {/* Live Indicator & Timer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1.5rem', alignItems: 'center' }}>
              <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> LIVE AUCTION
              </span>

              {/* Big Animated Countdown Clock */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                fontSize: '1.5rem', 
                fontWeight: 'bold', 
                color: timeLeftSeconds <= 5 ? '#ef4444' : '#eab308',
                background: 'rgba(0,0,0,0.4)',
                padding: '0.4rem 1rem',
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${timeLeftSeconds <= 5 ? '#ef4444' : '#eab308'}`
              }}>
                <Clock size={22} /> {timeLeftSeconds}s
              </div>
            </div>

            {/* Player Avatar & Details */}
            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '50%',
              border: '4px solid var(--primary)',
              overflow: 'hidden',
              background: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem',
              boxShadow: '0 0 25px rgba(74,222,128,0.3)'
            }}>
              {auction.player?.profiles?.avatar_url ? (
                <img src={auction.player.profiles.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={54} color="var(--text-muted)" />
              )}
            </div>

            <h1 style={{ fontSize: '2.5rem', marginBottom: '0.25rem', color: 'white' }}>
              {auction.player?.profiles?.username || 'Player on Block'}
            </h1>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ background: 'var(--primary)', color: 'black', padding: '0.25rem 0.8rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                {auction.player?.primary_position}
              </span>
              {auction.player?.specialties && auction.player.specialties.map((spec: string, i: number) => (
                <span key={i} style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)', padding: '0.25rem 0.8rem', borderRadius: 'var(--radius-full)', fontSize: '0.85rem' }}>
                  {spec}
                </span>
              ))}
            </div>

            {/* Current Highest Bid Display */}
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Current Highest Bid</div>
            <div style={{ fontSize: '4.5rem', fontWeight: '900', color: 'var(--primary)', lineHeight: 1, marginBottom: '0.5rem' }}>
              ${currentBidDisplay > 0 ? currentBidDisplay : fixedBasePrice}M
            </div>

            {auction.highest_bidder?.name ? (
              <div style={{ fontSize: '1.1rem', color: '#eab308', marginBottom: '2rem', fontWeight: 'bold' }}>
                Leading Bidder: {auction.highest_bidder.name}
              </div>
            ) : (
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
                Fixed Base Price: <strong>${fixedBasePrice}M</strong> (Waiting for first bid)
              </div>
            )}

            {/* Bidding Feedback Alert */}
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
                maxWidth: '480px'
              }}>
                {biddingMsg.text}
              </div>
            )}

            {/* PlayAuctionGame Style Quick-Bid Control Buttons */}
            <div style={{ width: '100%', maxWidth: '480px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                CLICK TO QUICK-BID (+RESISTS TIMER +15s)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {[5, 10, 25, 50].map(inc => (
                  <button
                    key={inc}
                    onClick={() => placeQuickBid(inc)}
                    className="btn btn-primary"
                    style={{
                      padding: '1rem 0.5rem',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: '0 4px 10px rgba(74,222,128,0.2)'
                    }}
                  >
                    +${inc}M
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Leaderboard & Controls Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Franchise Live Leaderboard */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h3 style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem', color: 'var(--primary)' }}>
                Franchises Leaderboard
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                {allTeams.length === 0 ? (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No teams created yet.</div>
                ) : (
                  allTeams.map(t => {
                    const isLeading = auction?.highest_bidder_id === t.id;
                    return (
                      <div 
                        key={t.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          background: isLeading ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0,0,0,0.3)',
                          border: isLeading ? '1px solid #eab308' : '1px solid var(--border)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: isLeading ? '#eab308' : 'white' }}>
                            {t.name} {isLeading && '👑'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Budget: ${t.budget}M</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Next Player / Finalize Button */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <button 
                onClick={finishCurrentAuctionAndAdvance} 
                className="btn" 
                style={{ width: '100%', background: '#ef4444', color: 'white', padding: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontWeight: 'bold' }}
              >
                Sell Player & Next <ChevronRight size={18} />
              </button>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
