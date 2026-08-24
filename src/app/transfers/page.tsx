'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TransferMarket() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<any>(null);
  
  const [marketPlayers, setMarketPlayers] = useState<any[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<any[]>([]);
  const [outgoingOffers, setOutgoingOffers] = useState<any[]>([]);
  
  const [offerAmount, setOfferAmount] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchData();
  }, [router]);

  const fetchData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth');
      return;
    }
    
    // Get my team
    const { data: team } = await supabase.from('teams').select('*').eq('manager_id', session.user.id).single();
    if (!team) {
      setLoading(false);
      return; // No team yet
    }
    setMyTeam(team);

    // Fetch players drafted by OTHER teams
    const { data: others } = await supabase
      .from('players')
      .select('*, profiles(username), team:teams(id, name)')
      .eq('status', 'drafted')
      .neq('team_id', team.id);
    if (others) setMarketPlayers(others);

    // Fetch incoming transfer offers (to my team)
    const { data: incoming } = await supabase
      .from('transfers')
      .select('*, player:players(profiles(username)), from_team:teams!from_team_id(name)')
      .eq('to_team_id', team.id)
      .eq('status', 'pending');
    if (incoming) setIncomingOffers(incoming);

    // Fetch outgoing transfer offers (from my team)
    const { data: outgoing } = await supabase
      .from('transfers')
      .select('*, player:players(profiles(username)), to_team:teams!to_team_id(name)')
      .eq('from_team_id', team.id)
      .eq('status', 'pending');
    if (outgoing) setOutgoingOffers(outgoing);

    setLoading(false);
  };

  const submitOffer = async (playerId: string, toTeamId: string) => {
    const amount = offerAmount[playerId];
    if (!amount || amount <= 0) return alert("Enter a valid amount.");
    if (amount > myTeam.budget) return alert("You don't have enough budget!");

    const { error } = await supabase.from('transfers').insert({
      player_id: playerId,
      from_team_id: myTeam.id,
      to_team_id: toTeamId,
      amount: amount
    });

    if (error) {
      alert("Failed to submit offer: " + error.message);
    } else {
      alert("Transfer offer submitted!");
      fetchData();
    }
  };

  const respondToOffer = async (transferId: string, accept: boolean, transfer: any) => {
    if (accept) {
      // 1. Mark transfer accepted
      await supabase.from('transfers').update({ status: 'accepted' }).eq('id', transferId);
      // 2. Transfer player
      await supabase.from('players').update({ team_id: transfer.from_team_id }).eq('id', transfer.player_id);
      // 3. Move money
      await supabase.rpc('process_transfer_payment', { 
        buyer_id: transfer.from_team_id, 
        seller_id: transfer.to_team_id, 
        transfer_amount: transfer.amount 
      });
      // NOTE: Since we didn't write an RPC function for the MVP, we'll just execute updates directly from client (unsafe for prod but fine for MVP).
      // We will do direct updates here instead of RPC:
      const { data: buyer } = await supabase.from('teams').select('budget').eq('id', transfer.from_team_id).single();
      const { data: seller } = await supabase.from('teams').select('budget').eq('id', transfer.to_team_id).single();
      if (buyer && seller) {
        await supabase.from('teams').update({ budget: buyer.budget - transfer.amount }).eq('id', transfer.from_team_id);
        await supabase.from('teams').update({ budget: seller.budget + transfer.amount }).eq('id', transfer.to_team_id);
      }
      alert("Transfer Accepted!");
    } else {
      await supabase.from('transfers').update({ status: 'rejected' }).eq('id', transferId);
      alert("Transfer Rejected!");
    }
    fetchData();
  };

  if (loading) return <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Transfer Market...</div>;

  if (!myTeam) return (
    <div className="container" style={{ textAlign: 'center', marginTop: '4rem' }}>
      You need to create a Team first! Go to the Team Dashboard.
    </div>
  );

  return (
    <div className="container animate-in">
      <header style={{ marginBottom: '3rem' }}>
        <h2 style={{ color: 'var(--primary)' }}>Transfer Market</h2>
        <p style={{ color: 'var(--text-muted)' }}>Buy players from other franchises or sell your own.</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Inbox */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Incoming Offers</h3>
          {incomingOffers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No incoming offers.</p>
          ) : (
            incomingOffers.map(offer => (
              <div key={offer.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                <p><strong>{offer.from_team?.name}</strong> wants to buy <strong>{offer.player?.profiles?.username}</strong></p>
                <p style={{ color: 'var(--primary)', fontSize: '1.5rem', margin: '0.5rem 0' }}>${offer.amount}M</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary" onClick={() => respondToOffer(offer.id, true, offer)}>Accept</button>
                  <button className="btn" style={{ background: '#ef4444', color: 'white' }} onClick={() => respondToOffer(offer.id, false, offer)}>Reject</button>
                </div>
              </div>
            ))
          )}

          <h3 style={{ margin: '2rem 0 1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Outgoing Offers</h3>
          {outgoingOffers.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No pending outgoing offers.</p>
          ) : (
            outgoingOffers.map(offer => (
              <div key={offer.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
                <p>You offered <strong>${offer.amount}M</strong> for <strong>{offer.player?.profiles?.username}</strong> ({offer.to_team?.name})</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Status: Pending Review</p>
              </div>
            ))
          )}
        </div>

        {/* Market */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Browse Players</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {marketPlayers.map(p => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{p.profiles?.username} <span style={{ color: 'var(--primary)' }}>({p.primary_position})</span></span>
                  <span style={{ color: 'var(--text-muted)' }}>{p.team?.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    placeholder="Offer $M"
                    onChange={(e) => setOfferAmount({...offerAmount, [p.id]: Number(e.target.value)})}
                    style={{ flex: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.4)', color: 'white', border: '1px solid var(--border)' }}
                  />
                  <button className="btn" style={{ background: 'white', color: 'black' }} onClick={() => submitOffer(p.id, p.team_id)}>
                    Submit Offer
                  </button>
                </div>
              </div>
            ))}
            {marketPlayers.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No drafted players on other teams yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
