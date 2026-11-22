import React, { useState, useEffect } from 'react';
import { X, History, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Play, Trophy } from 'lucide-react';
import Chessboard from './Chessboard';
import { api } from '../services/api';

export default function HistoryModal({ isOpen, onClose, onSelectGame }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [replayMoveIdx, setReplayMoveIdx] = useState(-1);

  useEffect(() => {
    if (isOpen) {
      loadGames();
    } else {
      setSelectedGame(null);
      setReplayMoveIdx(-1);
    }
  }, [isOpen]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const data = await api.listGames(30, 0);
      setGames(data);
    } catch (err) {
      console.error('Failed loading games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectGame = async (gameId) => {
    try {
      const fullGame = await api.getGame(gameId);
      setSelectedGame(fullGame);
      setReplayMoveIdx(fullGame.moves ? fullGame.moves.length - 1 : -1);
    } catch (err) {
      console.error('Failed fetching full game:', err);
    }
  };

  if (!isOpen) return null;

  const currentReplayFen =
    selectedGame && selectedGame.moves && selectedGame.moves.length > 0 && replayMoveIdx >= 0
      ? selectedGame.moves[replayMoveIdx]?.fen_after || selectedGame.fen
      : selectedGame?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-neutral-200/90 rounded-3xl w-full max-w-4xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-900">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-neutral-900 font-sans">
                Match Archives & Replay
              </h3>
              <p className="text-xs text-neutral-500 font-sans">Review past games and move trajectories</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1.5 rounded-full hover:bg-neutral-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Games List (Left) */}
          <div className="md:col-span-5 border-r border-neutral-100 overflow-y-auto p-4 space-y-2 bg-neutral-50/50">
            {loading ? (
              <div className="p-8 text-center text-xs text-neutral-400 font-sans">
                Loading game history...
              </div>
            ) : games.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 font-sans">
                No archived games recorded yet.
              </div>
            ) : (
              games.map((g) => {
                const isSelected = selectedGame?.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => handleSelectGame(g.id)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-neutral-900 shadow-md ring-1 ring-neutral-900'
                        : 'bg-white border-neutral-200/80 hover:border-neutral-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-neutral-400">
                        {g.id.slice(0, 8)}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700">
                        {g.result || '*'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-neutral-900 font-semibold">
                        {g.status === 'checkmate' ? 'Checkmate' : g.status}
                      </span>
                      <span className="text-[11px] text-neutral-500 font-mono">
                        {g.moves_count || 0} moves
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Replay Viewer (Right) */}
          <div className="md:col-span-7 p-6 flex flex-col items-center justify-between overflow-y-auto bg-white">
            {selectedGame ? (
              <>
                <div className="scale-90 transform-gpu origin-top">
                  <Chessboard
                    fen={currentReplayFen}
                    legalMoves={[]}
                    disabled={true}
                  />
                </div>

                {/* Replay Stepper Controls */}
                <div className="w-full flex items-center justify-between pt-4 border-t border-neutral-100">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setReplayMoveIdx(-1)}
                      disabled={replayMoveIdx <= -1}
                      className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30"
                    >
                      <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setReplayMoveIdx((prev) => Math.max(-1, prev - 1))}
                      disabled={replayMoveIdx <= -1}
                      className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 text-xs font-mono font-bold text-neutral-700">
                      {replayMoveIdx + 1} / {selectedGame.moves?.length || 0}
                    </span>
                    <button
                      onClick={() =>
                        setReplayMoveIdx((prev) =>
                          Math.min((selectedGame.moves?.length || 1) - 1, prev + 1)
                        )
                      }
                      disabled={replayMoveIdx >= (selectedGame.moves?.length || 0) - 1}
                      className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setReplayMoveIdx((selectedGame.moves?.length || 1) - 1)
                      }
                      disabled={replayMoveIdx >= (selectedGame.moves?.length || 0) - 1}
                      className="p-2 rounded-full border border-neutral-200 bg-white hover:bg-neutral-50 disabled:opacity-30"
                    >
                      <ChevronsRight className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectGame(selectedGame)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#ccff00] hover:bg-[#d9ff33] text-neutral-950 font-bold text-xs shadow-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Load Game</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-neutral-400 p-8 text-center font-sans">
                <Trophy className="w-8 h-8 mb-2 opacity-30 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-700">Select a match to replay</p>
                <p className="text-xs text-neutral-400 mt-1">Review move histories and step through states</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
