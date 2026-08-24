'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function AuctionRoom() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  const [auction, setAuction] = useState<any>(null);
  const [bids, setBids] = useState<any[]>([]);
  const [bidAmount, setBidAmount] = useState<number>(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
      } else {
        setUser(session.user);
      }
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    // Fetch current live auction
    const fetchLiveAuction = async () => {
      const { data } = await supabase
        .from('auctions')
        .select(`*, player:players(primary_position, specialties, profiles(username))`)
        .eq('status', 'live')
        .single();
      
      if (data) {
        setAuction(data);
        setBidAmount(Number(data.current_bid || data.base_price) + 10); // next minimum bid
      }
    };
    fetchLiveAuction();

    // Subscribe to realtime updates on auctions table
    const auctionChannel = supabase.channel('public:auctions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, (payload) => {
        const newRow = payload.new as any;
        if (newRow?.status === 'live') {
          // A new auction started or was updated
          fetchLiveAuction();
        } else if (newRow?.status === 'completed' && auction?.id === newRow?.id) {
          setAuction(null); // Auction ended
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(auctionChannel);
    };
  }, [auction?.id]);

  const placeBid = async () => {
    if (!auction) return;
    if (bidAmount <= auction.current_bid) {
      alert("Bid must be higher than current bid!");
      return;
    }
    
    // In a real app, you'd insert into a 'bids' table and trigger a Postgres function to update the auction safely to prevent race conditions.
    // For MVP, we'll update the auction table directly.
    const { error } = await supabase
      .from('auctions')
      .update({ current_bid: bidAmount, highest_bidder_id: user.id }) // assuming user.id is tied to a team for MVP
      .eq('id', auction.id);
      
    if (error) {
      alert("Failed to place bid: " + error.message);
    }
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Room...</div>;

  return (
    <div className="container animate-in">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <h2 style={{ color: 'var(--primary)' }}>Live Auction Room</h2>
        <div className="glass-panel" style={{ padding: '0.5rem 1rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Status:</span> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>● LIVE</span>
        </div>
      </header>

      {!auction ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h3 style={{ color: 'var(--text-muted)' }}>Waiting for the admin to start the next auction...</h3>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
          {/* Main Auction Block */}
          <div className="glass-panel" style={{ padding: '3rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{auction.player?.profiles?.username || 'Unknown Player'}</h1>
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
              <span style={{ background: 'var(--primary)', color: 'black', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)', fontWeight: 'bold' }}>
                {auction.player?.primary_position}
              </span>
              <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-full)' }}>
                {auction.player?.specialties?.join(', ') || 'No specialties listed'}
              </span>
            </div>

            <div style={{ fontSize: '1.25rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Current Highest Bid</div>
            <div style={{ fontSize: '4rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '2rem' }}>
              ${auction.current_bid || auction.base_price}M
            </div>

            <div style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '400px' }}>
              <input 
                type="number" 
                value={bidAmount} 
                onChange={e => setBidAmount(Number(e.target.value))}
                style={{ flex: 1, padding: '1rem', fontSize: '1.5rem', borderRadius: 'var(--radius-md)', background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid var(--border)' }}
              />
              <button onClick={placeBid} className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.25rem' }}>
                PLACE BID
              </button>
            </div>
          </div>

          {/* Activity / Bid History Sidebar */}
          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Recent Bids</h3>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* This would ideally map over a real bids table subscription */}
              <div style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Latest bid:</span> ${auction.current_bid || auction.base_price}M
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
