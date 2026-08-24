'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Trophy, Clock, DollarSign, PlusCircle, User, Play, ChevronRight, Zap, CheckCircle2, Shield, MessageSquare, Send, SkipForward } from 'lucide-react';

export default function AuctionRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [myTeam, setMyTeam] = useState<any>(null);

  const [auction, setAuction] = useState<any>(null);
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [biddingMsg, setBiddingMsg] = useState<{ type: string; text: string }>({ type: '', text: '' });
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(0);

  // Upcoming Queue Players List
  const [queuedPlayersList, setQueuedPlayersList] = useState<any[]>([]);

  // Host Setup & Multi-Player Queue State
  const [showHostPanel, setShowHostPanel] = useState(false);
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [uniformBasePrice, setUniformBasePrice] = useState<number>(10);
  const [timerDurationSeconds, setTimerDurationSeconds] = useState<number>(20);
  const [hostMsg, setHostMsg] = useState('');
  const [startingAuction, setStartingAuction] = useState(false);

  // Live Chat State
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; role: string; time: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuthAndTeam = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setUser(session.user);

      // Fetch user profile
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (prof) setUserProfile(prof);

      // Fetch user's team if manager
      const { data: teamData } = await supabase
        .from('teams')
        .select('*')
        .eq('manager_id', session.user.id)
        .maybeSingle();
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
      // Default select all available players for host checklist
      if (selectedPlayerIds.length === 0) {
        setSelectedPlayerIds(data.map((p: any) => p.id));
      }
    }
  };

  // Real-time Chat & Auction Sync
  useEffect(() => {
    fetchLiveAuction();
    fetchAvailablePlayers();

    // 1. Auction Realtime Channel
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

    // 2. Chat Realtime Broadcast Channel
    const chatChannel = supabase.channel('auction-chat')
      .on('broadcast', { event: 'new_chat' }, ({ payload }) => {
        setChatMessages(prev => [...prev, payload]);
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
      supabase.removeChannel(chatChannel);
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
      // Fetch upcoming queued players
      if (data.queue_player_ids && data.queue_player_ids.length > 0) {
        const remainingIds = data.queue_player_ids.slice((data.queue_index || 0) + 1);
        if (remainingIds.length > 0) {
          const { data: qPlayers } = await supabase
            .from('players')
            .select('*, profiles(username, avatar_url)')
            .in('id', remainingIds);
          if (qPlayers) setQueuedPlayersList(qPlayers);
        } else {
          setQueuedPlayersList([]);
        }
      }
    } else {
      setAuction(null);
      setQueuedPlayersList([]);
    }
  };

  // Real-time Timer Countdown & Auto-Advance
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

  // Send Chat Message
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const senderName = userProfile?.username || user?.email?.split('@')[0] || 'User';
    const userRoleText = userProfile?.role === 'admin' ? 'Admin' : myTeam ? 'Club Owner' : 'Spectator';

    const newMsg = {
      sender: senderName,
      text: chatInput.trim(),
      role: userRoleText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Broadcast message to all connected clients
    await supabase.channel('auction-chat').send({
      type: 'broadcast',
      event: 'new_chat',
      payload: newMsg
    });

    setChatMessages(prev => [...prev, newMsg]);
    setChatInput('');
    setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // Launch Live Auction Queue (Host Setup)
  const handleLaunchQueue = async () => {
    if (selectedPlayerIds.length === 0) {
      setHostMsg('Please select at least 1 registered player for the auction queue.');
      return;
    }

    setStartingAuction(true);
    setHostMsg('');

    try {
      const firstPlayerId = selectedPlayerIds[0];

      // Update base price for all selected players to uniform base price
      for (const pid of selectedPlayerIds) {
        await supabase.from('players').update({ base_price: uniformBasePrice }).eq('id', pid);
      }

      const timerEndsAt = new Date();
      timerEndsAt.setSeconds(timerEndsAt.getSeconds() + timerDurationSeconds);

      // If an existing live auction exists, close it
      if (auction) {
        await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);
      }

      const { error } = await supabase
        .from('auctions')
        .insert({
          player_id: firstPlayerId,
          host_id: user.id,
          queue_player_ids: selectedPlayerIds,
          queue_index: 0,
          skip_votes: [],
          status: 'live',
          base_price: uniformBasePrice,
          current_bid: 0,
          timer_ends_at: timerEndsAt.toISOString()
        });

      if (error) throw error;

      setHostMsg('Auction session launched with selected player queue!');
      setShowHostPanel(false);
      fetchLiveAuction();
    } catch (err: any) {
      setHostMsg('Error launching auction queue: ' + err.message);
    } finally {
      setStartingAuction(false);
    }
  };

  // Toggle Player Selection for Host Checklist
  const togglePlayerCheck = (id: string) => {
    setSelectedPlayerIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Quick-Bid Handler (Club Owners Only)
  const placeQuickBid = async (increment: number) => {
    setBiddingMsg({ type: '', text: '' });
    if (!auction) return;
    if (!myTeam) {
      setBiddingMsg({ type: 'error', text: 'Spectator Mode: You need a Franchise Team to bid! Go to "My Franchise".' });
      return;
    }

    const currentBid = Number(auction.current_bid || 0);
    const fixedBase = Number(auction.base_price || 10);
    
    let newBid = currentBid === 0 ? fixedBase + increment : currentBid + increment;

    if (newBid > myTeam.budget) {
      setBiddingMsg({ type: 'error', text: `Insufficient budget! Your team budget is $${myTeam.budget}M.` });
      return;
    }

    try {
      // Reset timer on new bid (+15s)
      const newTimerEnds = new Date();
      newTimerEnds.setSeconds(newTimerEnds.getSeconds() + 15);

      const { error } = await supabase
        .from('auctions')
        .update({
          current_bid: newBid,
          highest_bidder_id: myTeam.id,
          timer_ends_at: newTimerEnds.toISOString(),
          skip_votes: [] // clear skip votes on new bid
        })
        .eq('id', auction.id);

      if (error) throw error;

      setBiddingMsg({ type: 'success', text: `Placed bid of $${newBid}M! Timer reset +15s.` });
      fetchLiveAuction();
    } catch (err: any) {
      setBiddingMsg({ type: 'error', text: 'Failed to place bid: ' + err.message });
    }
  };

  // Vote Skip Current Player
  const handleVoteSkip = async () => {
    if (!auction) return;
    const voterId = myTeam?.id || user.id;
    const currentSkips = auction.skip_votes || [];

    if (currentSkips.includes(voterId)) {
      alert("You already voted to skip this player.");
      return;
    }

    const updatedSkips = [...currentSkips, voterId];
    const totalClubOwners = allTeams.length || 1;

    // Check if host or all active club owners voted skip
    const isHost = auction.host_id === user.id || userProfile?.role === 'admin';
    const isConsensus = updatedSkips.length >= totalClubOwners || isHost;

    if (isConsensus) {
      alert("Skip consensus reached! Skipping player and loading next in queue...");
      advanceToNextQueuedPlayer();
    } else {
      await supabase.from('auctions').update({ skip_votes: updatedSkips }).eq('id', auction.id);
      alert(`Skip vote added (${updatedSkips.length}/${totalClubOwners} votes).`);
      fetchLiveAuction();
    }
  };

  // Advance to Next Queued Player
  const advanceToNextQueuedPlayer = async () => {
    if (!auction) return;
    try {
      // Finalize current player if bids exist
      if (auction.highest_bidder_id && auction.current_bid > 0) {
        await supabase.from('players').update({ team_id: auction.highest_bidder_id, status: 'drafted' }).eq('id', auction.player_id);
        const { data: team } = await supabase.from('teams').select('budget').eq('id', auction.highest_bidder_id).single();
        if (team) {
          await supabase.from('teams').update({ budget: team.budget - auction.current_bid }).eq('id', auction.highest_bidder_id);
        }
      }

      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);

      const queue = auction.queue_player_ids || [];
      const nextIndex = (auction.queue_index || 0) + 1;

      if (nextIndex < queue.length) {
        const nextPlayerId = queue[nextIndex];
        const timerEndsAt = new Date();
        timerEndsAt.setSeconds(timerEndsAt.getSeconds() + timerDurationSeconds);

        await supabase.from('auctions').insert({
          player_id: nextPlayerId,
          host_id: auction.host_id,
          queue_player_ids: queue,
          queue_index: nextIndex,
          skip_votes: [],
          status: 'live',
          base_price: auction.base_price,
          current_bid: 0,
          timer_ends_at: timerEndsAt.toISOString()
        });
      } else {
        alert('All queued players completed!');
      }

      fetchLiveAuction();
      fetchAvailablePlayers();
      fetchTeams();
    } catch (err: any) {
      alert('Error advancing auction: ' + err.message);
    }
  };

  // Host Only End Auction Session
  const handleHostEndAuction = async () => {
    if (!auction) return;
    if (auction.host_id !== user.id && userProfile?.role !== 'admin') {
      alert("Only the Host who launched this session (or an Admin) can end the auction.");
      return;
    }

    try {
      await supabase.from('auctions').update({ status: 'completed' }).eq('id', auction.id);
      setAuction(null);
      alert('Auction session ended by host.');
      fetchAvailablePlayers();
      fetchTeams();
    } catch (err: any) {
      alert('Failed to end auction: ' + err.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Auction Arena...</div>;

  const currentBidDisplay = Number(auction?.current_bid || 0);
  const fixedBasePrice = Number(auction?.base_price || 10);
  const isHostOrAdmin = auction?.host_id === user.id || userProfile?.role === 'admin';
  const isClubOwner = !!myTeam;

  return (
    <div className="container animate-in" style={{ marginBottom: '4rem' }}>
      
      {/* Top Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', fontSize: '1.8rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Zap color="var(--primary)" size={28} /> Live Auction Arena
          </h2>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.9rem' }}>Real-time sequential bidding, live spectator chat & fixed base prices.</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {myTeam ? (
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: '1px solid var(--primary)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Franchise: </span>
              <span style={{ color: '#eab308', fontWeight: 'bold' }}>{myTeam.name}</span> (${myTeam.budget}M)
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', color: '#60a5fa', border: '1px solid #3b82f6' }}>
              👁️ Spectator Mode
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
            <PlusCircle size={18} /> {showHostPanel ? 'Close Host Setup' : 'Host / Setup Queue'}
          </button>
        </div>
      </header>

      {/* Host Setup & Multi-Player Checklist Panel */}
      {showHostPanel && (
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem', border: '1px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '0.5rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={20} /> Host Auction Queue Setup
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
            Select registered players for the auction sequence (e.g. 18 out of 20) and set a uniform Base Price.
          </p>

          {hostMsg && <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', borderRadius: 'var(--radius-sm)' }}>{hostMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Uniform Base Price ($ Millions)</label>
              <input 
                type="number" 
                min="1" 
                value={uniformBasePrice} 
                onChange={e => setUniformBasePrice(Number(e.target.value))} 
                style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Initial Countdown Window (Seconds)</label>
              <input 
                type="number" 
                min="10" 
                max="120" 
                value={timerDurationSeconds} 
                onChange={e => setTimerDurationSeconds(Number(e.target.value))} 
                style={{ width: '100%', padding: '0.65rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
              />
            </div>
          </div>

          {/* Multi-Player Checklist */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'white', fontSize: '0.9rem' }}>
              Select Players for Bidding Sequence ({selectedPlayerIds.length} Selected)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              {availablePlayers.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No available players found.</div>
              ) : (
                availablePlayers.map(p => {
                  const isChecked = selectedPlayerIds.includes(p.id);
                  return (
                    <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'white' }}>
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => togglePlayerCheck(p.id)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      <span>{p.profiles?.username} ({p.primary_position})</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <button 
            onClick={handleLaunchQueue} 
            className="btn btn-primary" 
            disabled={startingAuction || selectedPlayerIds.length === 0} 
            style={{ width: '100%', padding: '0.75rem' }}
          >
            {startingAuction ? 'Launching Sequence...' : `Launch Auction Queue (${selectedPlayerIds.length} Players)`}
          </button>
        </div>
      )}

      {/* Main Arena Content */}
      {!auction ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
          <Clock size={48} color="var(--text-muted)" style={{ marginBottom: '1rem' }} />
          <h3 style={{ color: 'white', marginBottom: '0.5rem' }}>No Active Live Auction</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
            Click <strong>"Host / Setup Queue"</strong> above to pick registered players and launch the auction sequence!
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem' }}>
          
          {/* Main Bidding Arena & Chat */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Active Player Bidding Card */}
            <div className="glass-panel" style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>
              
              {/* Header Timer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <span style={{ padding: '0.3rem 0.8rem', borderRadius: '20px', background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444', fontWeight: 'bold', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} /> LIVE AUCTION
                </span>

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

              {/* Avatar */}
              <div style={{
                width: '100px',
                height: '100px',
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
                  <User size={48} color="var(--text-muted)" />
                )}
              </div>

              <h1 style={{ fontSize: '2.25rem', marginBottom: '0.25rem', color: 'white' }}>
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

              {/* Current Highest Bid */}
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Current Highest Bid</div>
              <div style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--primary)', lineHeight: 1, marginBottom: '0.5rem' }}>
                ${currentBidDisplay > 0 ? currentBidDisplay : fixedBasePrice}M
              </div>

              {auction.highest_bidder?.name ? (
                <div style={{ fontSize: '1rem', color: '#eab308', marginBottom: '1.5rem', fontWeight: 'bold' }}>
                  Leading Bidder: {auction.highest_bidder.name}
                </div>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                  Uniform Base Price: <strong>${fixedBasePrice}M</strong> (No bids placed yet)
                </div>
              )}

              {/* Bidding Feedback */}
              {biddingMsg.text && (
                <div style={{
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  borderRadius: 'var(--radius-sm)',
                  background: biddingMsg.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                  color: biddingMsg.type === 'error' ? '#ef4444' : '#10b981',
                  border: `1px solid ${biddingMsg.type === 'error' ? '#ef4444' : '#10b981'}`,
                  fontSize: '0.875rem',
                  width: '100%',
                  maxWidth: '480px'
                }}>
                  {biddingMsg.text}
                </div>
              )}

              {/* Quick-Bid Controls for Club Owners */}
              <div style={{ width: '100%', maxWidth: '480px' }}>
                {isClubOwner ? (
                  <>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      QUICK-BID INCREMENTS (+RESISTS TIMER +15s)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
                      {[5, 10, 25, 50].map(inc => (
                        <button
                          key={inc}
                          onClick={() => placeQuickBid(inc)}
                          className="btn btn-primary"
                          style={{ padding: '0.85rem 0.25rem', fontSize: '1rem', fontWeight: 'bold' }}
                        >
                          +${inc}M
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '1rem', background: 'rgba(59,130,246,0.1)', border: '1px solid #3b82f6', color: '#60a5fa', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                    👁️ Spectator Mode: You are viewing live bidding. To bid on players, create a Franchise in "My Franchise".
                  </div>
                )}

                {/* Consensus Skip / Pass Button */}
                <button
                  onClick={handleVoteSkip}
                  className="btn"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <SkipForward size={16} /> Vote to Skip Current Player ({auction.skip_votes?.length || 0} Skips)
                </button>
              </div>

            </div>

            {/* Live Spectator & Player Chat Room */}
            <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', height: '280px' }}>
              <h4 style={{ margin: 0, marginBottom: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem' }}>
                <MessageSquare size={18} /> Live Auction Chat
              </h4>

              {/* Chat Message Scroll */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', paddingRight: '0.5rem' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
                    No messages yet. Send a message to chat live with everyone!
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>{msg.sender}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{msg.time}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{msg.text}</div>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="Type a live chat message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                  <Send size={16} />
                </button>
              </form>
            </div>

          </div>

          {/* Right Sidebar: Upcoming Queue & Leaderboard */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Upcoming Players Queue */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ChevronRight size={18} /> Upcoming Players Queue ({queuedPlayersList.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                {queuedPlayersList.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No upcoming players queued.</div>
                ) : (
                  queuedPlayersList.map((qp, i) => (
                    <div key={qp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.75rem' }}>#{i + 1}</span>
                      <span style={{ color: 'white', fontWeight: '500', flex: 1 }}>{qp.profiles?.username}</span>
                      <span style={{ padding: '0.15rem 0.4rem', background: 'var(--primary)', color: 'black', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.7rem' }}>
                        {qp.primary_position}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Franchises Leaderboard */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.75rem', color: 'var(--primary)', fontSize: '1rem' }}>
                Franchises Leaderboard
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                {allTeams.length === 0 ? (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No teams registered yet.</div>
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
                          padding: '0.6rem',
                          borderRadius: 'var(--radius-sm)',
                          background: isLeading ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0,0,0,0.3)',
                          border: isLeading ? '1px solid #eab308' : '1px solid var(--border)'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isLeading ? '#eab308' : 'white' }}>
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

            {/* Host Only End Control */}
            {isHostOrAdmin && (
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <button 
                  onClick={handleHostEndAuction} 
                  className="btn" 
                  style={{ width: '100%', background: '#ef4444', color: 'white', padding: '0.75rem', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                  End Auction Session (Host Only)
                </button>
              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}
