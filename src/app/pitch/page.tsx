'use client';

import { useState, useEffect } from 'react';
import { DndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Draggable Player Component
function DraggablePlayer({ player, x, y }: { player: any, x: number, y: number }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: player.id,
    data: { player }
  });

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    zIndex: isDragging ? 100 : 10,
    cursor: 'grab',
    backgroundColor: 'var(--surface)',
    border: '2px solid var(--primary)',
    borderRadius: '50%',
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    color: 'white',
    boxShadow: isDragging ? '0 0 20px var(--primary-glow)' : '0 4px 6px rgba(0,0,0,0.3)'
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      {player.primary_position}
      <div style={{ position: 'absolute', bottom: '-25px', whiteSpace: 'nowrap', fontSize: '12px', color: 'white', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', borderRadius: '4px' }}>
        {player.profiles?.username}
      </div>
    </div>
  );
}

// Droppable Pitch Area
function DroppablePitch({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id: 'pitch-area',
  });

  return (
    <div 
      ref={setNodeRef} 
      style={{ 
        width: '100%', 
        height: '600px', 
        backgroundColor: '#2e7d32', // Grass green
        border: '4px solid white',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(255,255,255,0.05) 50px, rgba(255,255,255,0.05) 100px)'
      }}
    >
      {/* Pitch Markings */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '2px', background: 'rgba(255,255,255,0.5)', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'absolute', top: '50%', left: '50%', width: '100px', height: '100px', border: '2px solid rgba(255,255,255,0.5)', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
      <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: '15%', border: '2px solid rgba(255,255,255,0.5)', borderLeft: 'none' }} />
      <div style={{ position: 'absolute', right: 0, top: '20%', bottom: '20%', width: '15%', border: '2px solid rgba(255,255,255,0.5)', borderRight: 'none' }} />
      
      {children}
    </div>
  );
}

export default function InteractivePitch() {
  const router = useRouter();
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeamPlayers = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      
      const { data: team } = await supabase.from('teams').select('id').eq('manager_id', session.user.id).single();
      if (team) {
        const { data: teamPlayers } = await supabase.from('players').select('*, profiles(username)').eq('team_id', team.id);
        if (teamPlayers) {
          // Initialize coordinates if not set in DB (for MVP we'll just keep coordinates in memory, but could save to DB)
          const positionedPlayers = teamPlayers.map((p, i) => ({
            ...p,
            x: 50 + (i * 60),
            y: 50 + (i * 30)
          }));
          setPlayers(positionedPlayers);
        }
      }
      setLoading(false);
    };
    fetchTeamPlayers();
  }, [router]);

  const handleDragEnd = (event: any) => {
    const { active, delta } = event;
    
    setPlayers((prev) => 
      prev.map((player) => {
        if (player.id === active.id) {
          return {
            ...player,
            x: player.x + delta.x,
            y: player.y + delta.y,
          };
        }
        return player;
      })
    );
  };

  return (
    <div className="container animate-in">
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: 'var(--primary)' }}>Tactical Board</h2>
        <p style={{ color: 'var(--text-muted)' }}>Freely move your drafted players to set up your custom formation.</p>
      </header>

      <DndContext onDragEnd={handleDragEnd}>
        <DroppablePitch>
          {players.map((p) => (
            <DraggablePlayer key={p.id} player={p} x={p.x} y={p.y} />
          ))}
        </DroppablePitch>
      </DndContext>
    </div>
  );
}
