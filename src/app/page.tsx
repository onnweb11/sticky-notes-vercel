'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Trash2, GripHorizontal, Palette, X, Info } from 'lucide-react';

// --- Types ---
type NoteColor = 'yellow' | 'blue' | 'green' | 'pink' | 'orange' | 'purple';

interface Note {
  id: string;
  x: number;
  y: number;
  content: string;
  color: NoteColor;
  zIndex: number;
  width: number;
  height: number;
}

interface DragState {
  isDragging: boolean;
  noteId: string | null;
  startX: number;
  startY: number;
  initialNoteX: number;
  initialNoteY: number;
}

// --- Constants ---
const COLORS: Record<NoteColor, { bg: string; border: string; handle: string }> = {
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-200', handle: 'bg-yellow-200/50' },
  blue:   { bg: 'bg-sky-100',    border: 'border-sky-200',    handle: 'bg-sky-200/50' },
  green:  { bg: 'bg-lime-100',   border: 'border-lime-200',   handle: 'bg-lime-200/50' },
  pink:   { bg: 'bg-rose-100',   border: 'border-rose-200',   handle: 'bg-rose-200/50' },
  orange: { bg: 'bg-orange-100', border: 'border-orange-200', handle: 'bg-orange-200/50' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-200', handle: 'bg-purple-200/50' },
};

const COLOR_KEYS = Object.keys(COLORS) as NoteColor[];
const DEFAULT_WIDTH = 220;
const DEFAULT_HEIGHT = 220;
const STORAGE_KEY = 'sticky-notes-app-data';

export default function StickyNotesApp() {
  // --- State ---
  const [notes, setNotes] = useState<Note[]>([]);
  const [maxZIndex, setMaxZIndex] = useState<number>(1);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    noteId: null,
    startX: 0,
    startY: 0,
    initialNoteX: 0,
    initialNoteY: 0,
  });
  const [showTutorial, setShowTutorial] = useState(true);

  // --- Refs ---
  // Use a ref for notes during drag to avoid stale closures in event listeners if not using dependencies carefully
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // --- Effects ---
  // Load from local storage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setNotes(parsed);
          // Determine max z-index from loaded notes
          const maxZ = parsed.reduce((max, note) => Math.max(max, note.zIndex || 1), 1);
          setMaxZIndex(maxZ + 1);
          if (parsed.length > 0) setShowTutorial(false);
        }
      }
    } catch (e) {
      console.error('Failed to load notes from local storage', e);
    }
  }, []);

  // Save to local storage whenever notes change
  useEffect(() => {
    if (notes.length > 0 || !showTutorial) { // Don't wipe storage if just initial empty state before load
       localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    }
  }, [notes, showTutorial]);


  // --- Event Handlers ---

  const addNote = () => {
    const newZIndex = maxZIndex + 1;
    setMaxZIndex(newZIndex);

    // Randomize start position slightly so they don't stack perfectly
    const startX = 50 + Math.random() * 100;
    const startY = 80 + Math.random() * 100;
    const randomColor = COLOR_KEYS[Math.floor(Math.random() * COLOR_KEYS.length)];

    const newNote: Note = {
      id: crypto.randomUUID(),
      x: startX,
      y: startY,
      content: '',
      color: randomColor,
      zIndex: newZIndex,
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
    };

    setNotes((prev) => [...prev, newNote]);
    setShowTutorial(false);
  };

  const updateNoteContent = (id: string, content: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
  };

  const updateNoteColor = (id: string, color: NoteColor) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, color } : n)));
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const bringToFront = (id: string) => {
    const targetNote = notes.find(n => n.id === id);
    if (targetNote && targetNote.zIndex === maxZIndex) return; // Already at front

    const newZ = maxZIndex + 1;
    setMaxZIndex(newZ);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, zIndex: newZ } : n)));
  };

  const clearAll = () => {
    if (window.confirm('Are you sure you want to delete all notes?')) {
      setNotes([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  // --- Drag & Drop Logic ---

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent, id: string) => {
    // Prevent interacting with textareas from starting a drag if we wanted, 
    // but we are putting the handler on the grip handle specifically.
    
    // e.preventDefault(); // Don't always prevent default, might block scrolling on touch devices if not careful.

    const note = notes.find((n) => n.id === id);
    if (!note) return;

    bringToFront(id);

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    setDragState({
      isDragging: true,
      noteId: id,
      startX: clientX,
      startY: clientY,
      initialNoteX: note.x,
      initialNoteY: note.y,
    });
  };

  // Use useCallback so we can add/remove these window listeners efficiently
  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!dragState.isDragging || !dragState.noteId) return;

      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const deltaX = clientX - dragState.startX;
      const deltaY = clientY - dragState.startY;

      setNotes((prevNotes) =>
        prevNotes.map((n) =>
          n.id === dragState.noteId
            ? { ...n, x: dragState.initialNoteX + deltaX, y: dragState.initialNoteY + deltaY }
            : n
        )
      );
    },
    [dragState]
  );

  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState((prev) => ({ ...prev, isDragging: false, noteId: null }));
    }
  }, [dragState.isDragging]);

  // Attach global event listeners when dragging active
  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [dragState.isDragging, handleMouseMove, handleMouseUp]);


  return (
    <div className="min-h-screen w-full bg-stone-50 overflow-hidden relative text-stone-800 font-sans">
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] opacity-70" />

      {/* --- Toolbar --- */}
      <header className="fixed top-0 left-0 right-0 h-16 px-6 flex items-center justify-between z-50 pointer-events-none">
        <div className="flex items-center space-x-2 pointer-events-auto bg-white/80 backdrop-blur-sm p-2 rounded-xl shadow-sm border border-stone-200/50">
          <div className="w-8 h-8 bg-yellow-300 rounded-md shadow-sm border border-yellow-400 flex items-center justify-center mr-2">
             <span className="text-yellow-700 font-bold text-lg leading-none mt-[-2px]">S</span>
          </div>
          <h1 className="text-stone-700 font-bold text-lg hidden sm:block">Sticky Board</h1>
        </div>

        <div className="flex items-center space-x-3 pointer-events-auto">
          {notes.length > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md hover:bg-red-50 text-stone-600 hover:text-red-600 rounded-full text-sm font-medium transition-colors shadow-sm border border-stone-200/50"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Clear Board</span>
            </button>
          )}

          <button
            onClick={addNote}
            className="flex items-center gap-2 px-5 py-2.5 bg-stone-800 hover:bg-stone-900 text-white rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="font-semibold">New Note</span>
          </button>
        </div>
      </header>

      {/* --- Tutorial Empty State --- */}
      {notes.length === 0 && showTutorial && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 animate-in fade-in duration-700">
          <div className="max-w-md text-center space-y-6 bg-white/60 backdrop-blur-md p-8 rounded-3xl border border-stone-100 shadow-xl">
            <div className="w-20 h-20 bg-yellow-100 rounded-2xl mx-auto flex items-center justify-center shadow-sm rotate-[-6deg] border border-yellow-200">
              <Palette size={32} className="text-yellow-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-stone-800">Your board is empty</h2>
              <p className="text-stone-500">
                Click the "New Note" button to start organizing your thoughts.
              </p>
            </div>
            <button
              onClick={addNote}
              className="px-6 py-3 bg-stone-800 text-stone-50 rounded-xl font-medium hover:bg-stone-900 transition-colors shadow-md w-full sm:w-auto"
            >
              Add your first note
            </button>
          </div>
        </div>
      )}

      {/* --- Notes Canvas --- */}
      <main className="absolute inset-0 w-full h-full overflow-auto">
        <div className="relative min-w-full min-h-full w-[3000px] h-[2000px]" /* Large canvas area */ >
          {notes.map((note) => {
            const isDraggingThis = dragState.isDragging && dragState.noteId === note.id;
            const colors = COLORS[note.color];

            return (
              <div
                key={note.id}
                style={{
                  transform: `translate(${note.x}px, ${note.y}px) rotate(${isDraggingThis ? '-2deg' : '0deg'}) scale(${isDraggingThis ? 1.02 : 1})`,
                  width: note.width,
                  height: note.height,
                  zIndex: note.zIndex,
                }}
                className={`absolute flex flex-col rounded-lg shadow-sm transition-shadow duration-200 ${colors.bg} border ${colors.border} ${isDraggingThis ? 'shadow-xl !z-[9999] cursor-grabbing' : 'hover:shadow-md'}`}
                onMouseDown={() => bringToFront(note.id)}
                onTouchStart={() => bringToFront(note.id)}
              >
                {/* --- Note Handle --- */}
                <div
                  className={`flex-shrink-0 h-9 ${colors.handle} cursor-grab active:cursor-grabbing flex items-center justify-between px-2 rounded-t-lg border-b ${colors.border}`}
                  onMouseDown={(e) => handleDragStart(e, note.id)}
                  onTouchStart={(e) => handleDragStart(e, note.id)}
                >
                  <GripHorizontal size={16} className="text-stone-500/50" />
                  
                  {/* Color Picker Helpers */}
                  <div className="flex space-x-1 ml-auto mr-2 group-hover:opacity-100 transition-opacity opacity-0 sm:opacity-0 note-hover-trigger">
                     {COLOR_KEYS.map(c => (
                       <button
                        key={c}
                        onClick={(e) => {
                          e.stopPropagation();
                          updateNoteColor(note.id, c);
                        }}
                        className={`w-3 h-3 rounded-full border border-black/10 hover:scale-125 transition-transform ${COLORS[c].bg}`}
                        title={`Change to ${c}`}
                       />
                     ))}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent drag start
                      deleteNote(note.id);
                    }}
                    className="text-stone-400 hover:text-red-500 hover:bg-red-500/10 p-1 rounded transition-colors"
                    title="Delete note"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* --- Note Content --- */}
                <textarea
                  value={note.content}
                  onChange={(e) => updateNoteContent(note.id, e.target.value)}
                  placeholder="Type something..."
                  className={`flex-grow w-full resize-none bg-transparent p-3 text-stone-800 placeholder-stone-400/70 focus:outline-none text-[15px] leading-relaxed font-medium ${isDraggingThis ? 'pointer-events-none' : ''}`}
                  spellCheck={false}
                />

                {/* Hover trigger for color picker (css-based for simplicity in single component) */}
                <style jsx>{`
                  .note-hover-trigger {
                    opacity: 0;
                  }
                  div:hover > div > .note-hover-trigger {
                    opacity: 1;
                  }
                `}</style>
              </div>
            );
          })}
        </div>
      </main>

      {/* --- Help Tip --- */}
      <div className="fixed bottom-4 right-4 pointer-events-none z-40">
        <div className="bg-white/80 backdrop-blur-md shadow-sm border border-stone-200 px-4 py-2 rounded-full flex items-center gap-2 text-xs font-medium text-stone-500 opacity-0 sm:opacity-60 hover:opacity-100 transition-opacity pointer-events-auto">
          <Info size={14} />
          <span>Drag header to move • Hover header for colors</span>
        </div>
      </div>
    </div>
  );
}
