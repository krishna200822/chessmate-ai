import React, { useState } from 'react';

// High-detail SVG vector chess piece icons (self-contained, no external CDN dependencies)
const PIECE_SVGS = {
  // White Pieces
  P: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  N: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 3-6 2.1-2.6 4.5-4.1 6-7 1.5-2.9 2-4.5 4-6v6z" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="9.5" cy="25.5" r="1.5" fill="#0f172a" />
    </svg>
  ),
  B: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        <path d="M17.5 26h10M15 30h15" fill="none" />
      </g>
    </svg>
  ),
  R: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm1-4h19l-1.5-15h-16L13 32zm-2-15h23v-6h-3v3h-4v-3h-4v3h-4v-3h-4v3h-4v-3H11v6z" />
        <path d="M14 29.5v-13M31 29.5v-13" fill="none" strokeLinejoin="miter" />
      </g>
    </svg>
  ),
  Q: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zm0 3.5h27M9 33.5h27M9 37.5h27" />
      </g>
    </svg>
  ),
  K: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
        <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-1-1-4-6-4-3 0-4 2-6 2s-3-2-6-2c-5 0-2 3-6 4-3 6 6 10.5 6 10.5v7z" />
        <path d="M11.5 30c5.5-3 16.5-3 22 0M11.5 33.5c5.5-3 16.5-3 22 0M11.5 37c5.5-3 16.5-3 22 0" fill="none" />
      </g>
    </svg>
  ),

  // Black Pieces
  p: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  n: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
      <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-4.04 3-6 2.1-2.6 4.5-4.1 6-7 1.5-2.9 2-4.5 4-6v6z" fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" />
      <circle cx="9.5" cy="25.5" r="1.5" fill="#38bdf8" />
    </svg>
  ),
  b: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.354.49-2.323.47-3-.5 1.354-1.94 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z" />
        <path d="M17.5 26h10M15 30h15" fill="none" stroke="#64748b" />
      </g>
    </svg>
  ),
  r: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 39h27v-3H9v3zm3-3v-4h21v4H12zm1-4h19l-1.5-15h-16L13 32zm-2-15h23v-6h-3v3h-4v-3h-4v3h-4v-3h-4v3h-4v-3H11v6z" />
        <path d="M14 29.5v-13M31 29.5v-13" fill="none" stroke="#64748b" strokeLinejoin="miter" />
      </g>
    </svg>
  ),
  q: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM24.5 7.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM16 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM33 8.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0z" />
        <path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V11l-5.5 13.5-3-15-3 15-5.5-14V25L7 14l2 12zm0 3.5h27M9 33.5h27M9 37.5h27" />
      </g>
    </svg>
  ),
  k: (
    <svg viewBox="0 0 45 45" className="w-full h-full drop-shadow select-none pointer-events-none" draggable={false}>
      <g fill="#0f172a" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22.5 11.63V6M20 8h5" strokeLinejoin="miter" />
        <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
        <path d="M11.5 37c5.5 3.5 16.5 3.5 22 0v-7s9-4.5 6-10.5c-4-1-1-4-6-4-3 0-4 2-6 2s-3-2-6-2c-5 0-2 3-6 4-3 6 6 10.5 6 10.5v7z" />
        <path d="M11.5 30c5.5-3 16.5-3 22 0M11.5 33.5c5.5-3 16.5-3 22 0M11.5 37c5.5-3 16.5-3 22 0" fill="none" stroke="#64748b" />
      </g>
    </svg>
  ),
};

function parseFenToBoard(fen) {
  const board = Array(8).fill(null).map(() => Array(8).fill(null));
  if (!fen) return board;

  const parts = fen.split(' ');
  const rows = parts[0].split('/');

  for (let r = 0; r < 8; r++) {
    let col = 0;
    for (const char of rows[r]) {
      if (char >= '1' && char <= '8') {
        col += parseInt(char, 10);
      } else {
        board[r][col] = char;
        col++;
      }
    }
  }
  return board;
}

export default function Chessboard({
  fen,
  legalMoves = [],
  lastMove = null,
  isCheck = false,
  turn = 'white',
  humanColor = 'white',
  disabled = false,
  onMakeMove,
}) {
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [draggedSquare, setDraggedSquare] = useState(null);
  const [dragOverSquare, setDragOverSquare] = useState(null);
  const [promotionPending, setPromotionPending] = useState(null);

  const board = parseFenToBoard(fen);
  const isFlipped = humanColor === 'black';

  // Files and ranks
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  // Map 0-7 indices to square names (e.g. 0,0 is a8)
  const getSquareName = (r, c) => `${files[c]}${ranks[r]}`;

  // Helper to check if a piece belongs to current turn player
  const isPieceTurn = (piece) => {
    if (!piece) return false;
    const isWhitePiece = piece === piece.toUpperCase();
    return (turn === 'white' && isWhitePiece) || (turn === 'black' && !isWhitePiece);
  };

  // Find candidate destinations for currently selected or dragged square
  const activeSourceSquare = draggedSquare || selectedSquare;
  const candidateMoves = React.useMemo(() => {
    if (!activeSourceSquare) return [];
    return legalMoves.filter((m) => m.startsWith(activeSourceSquare));
  }, [activeSourceSquare, legalMoves]);

  const candidateDestSquares = React.useMemo(() => {
    return new Set(candidateMoves.map((m) => m.slice(2, 4)));
  }, [candidateMoves]);

  // Find king position if check
  const kingCheckSquare = React.useMemo(() => {
    if (!isCheck) return null;
    const kingSymbol = turn === 'white' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (board[r][c] === kingSymbol) {
          return getSquareName(r, c);
        }
      }
    }
    return null;
  }, [board, isCheck, turn]);

  // Execute or stage move (handles promotion detection)
  const attemptMove = (sourceSquare, targetSquare) => {
    const uciMove = `${sourceSquare}${targetSquare}`;
    const isPromotionMove = legalMoves.some((m) => m.startsWith(uciMove) && m.length === 5);

    if (isPromotionMove) {
      setPromotionPending({ uciBase: uciMove, targetSquare });
      return;
    }

    if (legalMoves.includes(uciMove) || candidateDestSquares.has(targetSquare)) {
      onMakeMove(uciMove);
      setSelectedSquare(null);
      setDraggedSquare(null);
    }
  };

  // Click-to-Move Handler
  const handleSquareClick = (squareName, piece) => {
    if (disabled) return;

    // If clicking a valid destination for selected piece
    if (selectedSquare && candidateDestSquares.has(squareName)) {
      attemptMove(selectedSquare, squareName);
      return;
    }

    // If clicking on user's piece to select
    if (piece && isPieceTurn(piece)) {
      setSelectedSquare(squareName === selectedSquare ? null : squareName);
      return;
    }

    // Deselect if clicking empty square or opponent piece without move
    setSelectedSquare(null);
  };

  // Drag-and-Drop Handlers
  const handleDragStart = (e, squareName, piece) => {
    if (disabled || !isPieceTurn(piece)) {
      e.preventDefault();
      return;
    }

    setDraggedSquare(squareName);
    setSelectedSquare(squareName);
    e.dataTransfer.setData('text/plain', squareName);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedSquare(null);
    setDragOverSquare(null);
  };

  const handleDragOver = (e, squareName) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverSquare !== squareName) {
      setDragOverSquare(squareName);
    }
  };

  const handleDragLeave = (e, squareName) => {
    if (dragOverSquare === squareName) {
      setDragOverSquare(null);
    }
  };

  const handleDrop = (e, targetSquare) => {
    e.preventDefault();
    setDragOverSquare(null);

    const sourceSquare = e.dataTransfer.getData('text/plain') || draggedSquare;
    if (!sourceSquare || sourceSquare === targetSquare) {
      setDraggedSquare(null);
      return;
    }

    attemptMove(sourceSquare, targetSquare);
    setDraggedSquare(null);
  };

  const handlePromotionSelect = (pieceChoice) => {
    if (promotionPending) {
      onMakeMove(`${promotionPending.uciBase}${pieceChoice}`);
      setPromotionPending(null);
      setSelectedSquare(null);
      setDraggedSquare(null);
    }
  };

  // Grid coordinates mapping according to flip
  const rowIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colIndices = isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <div className="relative inline-block p-3 sm:p-4 rounded-3xl bg-white border border-neutral-200/90 shadow-[0_10px_30px_rgba(0,0,0,0.04)] select-none">
      {/* Board Outer Grid */}
      <div className="relative grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] md:w-[460px] md:h-[460px] border border-neutral-300/80 rounded-2xl overflow-hidden select-none shadow-inner">
        {rowIndices.map((r, rowIdx) =>
          colIndices.map((c, colIdx) => {
            const squareName = getSquareName(r, c);
            const piece = board[r][c];
            const isDark = (r + c) % 2 === 1;

            const isSelected = selectedSquare === squareName || draggedSquare === squareName;
            const isLastMoveSquare =
              lastMove && (lastMove.from === squareName || lastMove.to === squareName);
            const isCandidate = candidateDestSquares.has(squareName);
            const isCapturable = isCandidate && piece !== null;
            const isKingInCheck = kingCheckSquare === squareName;
            const isDragTarget = dragOverSquare === squareName && isCandidate;
            const canDragThisPiece = !disabled && isPieceTurn(piece);

            return (
              <div
                key={squareName}
                onClick={() => handleSquareClick(squareName, piece)}
                onDragOver={(e) => handleDragOver(e, squareName)}
                onDragLeave={(e) => handleDragLeave(e, squareName)}
                onDrop={(e) => handleDrop(e, squareName)}
                className={`relative flex items-center justify-center cursor-pointer transition-colors duration-150 ${
                  isDark ? 'bg-[#18181b]' : 'bg-[#ffffff]'
                } ${isSelected ? '!bg-[#ccff00]/30 ring-2 ring-[#ccff00] inset-0 z-10' : ''} ${
                  isDragTarget ? '!bg-[#ccff00]/50 ring-4 ring-[#ccff00] z-20 scale-[1.02]' : ''
                } ${isLastMoveSquare ? '!bg-[#ccff00]/15 ring-1 ring-[#ccff00]/50' : ''} ${
                  isKingInCheck ? '!bg-rose-500/30 ring-2 ring-rose-500 animate-pulse' : ''
                }`}
              >
                {/* File / Rank Coordinates on edges */}
                {colIdx === 0 && (
                  <span
                    className={`absolute top-0.5 left-1 text-[10px] font-mono font-bold tracking-tight select-none pointer-events-none ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {ranks[r]}
                  </span>
                )}
                {rowIdx === 7 && (
                  <span
                    className={`absolute bottom-0.5 right-1 text-[10px] font-mono font-bold tracking-tight select-none pointer-events-none ${
                      isDark ? 'text-neutral-400' : 'text-neutral-500'
                    }`}
                  >
                    {files[c]}
                  </span>
                )}

                {/* Chess Piece Vector - Click-to-Move with ghost-drag prevention */}
                {piece && PIECE_SVGS[piece] && (
                  <div
                    draggable={false}
                    className="w-[82%] h-[82%] relative z-10 select-none pointer-events-none transition-transform hover:scale-105 active:scale-95 drop-shadow-sm"
                  >
                    <div className="w-full h-full pointer-events-none select-none" draggable={false}>
                      {PIECE_SVGS[piece]}
                    </div>
                  </div>
                )}

                {/* Move Highlight: Empty Square Dot (Electric Lime Glow) */}
                {isCandidate && !isCapturable && (
                  <div className="absolute w-3.5 h-3.5 rounded-full bg-[#ccff00] shadow-[0_0_10px_#ccff00] z-20 pointer-events-none" />
                )}

                {/* Move Highlight: Capture Ring */}
                {isCapturable && (
                  <div className="absolute inset-1 rounded-full border-2 border-[#ccff00] bg-[#ccff00]/20 z-20 pointer-events-none" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Promotion Choice Modal */}
      {promotionPending && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-3xl flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-neutral-200 p-5 rounded-2xl shadow-2xl text-center">
            <h4 className="text-xs font-sans font-bold text-neutral-900 mb-3 tracking-wider uppercase">
              Choose Promotion
            </h4>
            <div className="flex space-x-3">
              {['q', 'r', 'b', 'n'].map((p) => {
                const symbol = turn === 'white' ? p.toUpperCase() : p;
                return (
                  <button
                    key={p}
                    onClick={() => handlePromotionSelect(p)}
                    className="w-12 h-12 p-2 rounded-xl bg-neutral-50 hover:bg-[#ccff00]/20 border border-neutral-200 hover:border-[#ccff00] transition-all flex items-center justify-center shadow-sm"
                  >
                    {PIECE_SVGS[symbol]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
