import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Beef, Camera, Check, ChevronDown, ChevronRight, ChevronUp, Clock, Coffee, Cookie, Copy, Droplets, Dumbbell, FileText, Flame, GripVertical, History, Minus, Moon, Pencil, Plus, RefreshCw, Repeat, Ruler, ScanBarcode, Scale, Share2, SlidersHorizontal, Sparkles, StickyNote, Sun, Target, Timer, Trash2, TrendingUp, Trophy, UserPlus, Users, Utensils, Wheat, X, Zap } from 'lucide-react';
import { useGym } from './store';
import { MUSCLES, calcStreak, e1rm, fmt, friendCodeOf, iso, parseRoutines, todayRoutine, weekSets, weekVol } from './lib';
import { Bar, Card, Ring, field, muted, primary } from './ui';

const bad = 'text-rose-600 dark:text-rose-400';
const shortDate = (d) => new Date(`${d}T00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const dayParts = (d) => {
  const dt = new Date(`${d}T00:00`);
  return {
    day: dt.toLocaleDateString('es-ES', { day: '2-digit' }),
    month: dt.toLocaleDateString('es-ES', { month: 'short' }).replace('.', ''),
  };
};
const trash = 'flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10 dark:hover:text-rose-300';
const mmss = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;

const formatDur = (sec = 0) => {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
};

const formatMins = (sec = 0) => {
  const mins = Math.max(1, Math.round(sec / 60));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Tipos de serie (W = Calentamiento, D = Drop-set, F = Al fallo) y opciones de RIR
const SET_TYPES = [
  { id: '', short: 'N', label: 'Normal' },
  { id: 'W', short: 'W', label: 'Calent.' },
  { id: 'D', short: 'D', label: 'Drop' },
  { id: 'F', short: 'F', label: 'Fallo' },
];
const RIR_OPTIONS = ['0', '1', '2', '3+'];

const setTypeMeta = (type) => {
  if (type === 'W') return { short: 'W', name: 'Calentamiento', badge: 'border border-dashed border-zinc-400 text-zinc-600 dark:border-zinc-500 dark:text-zinc-300' };
  if (type === 'D') return { short: 'D', name: 'Drop-set', badge: 'bg-zinc-300 text-zinc-900 dark:bg-zinc-700 dark:text-white' };
  if (type === 'F') return { short: 'F', name: 'Al fallo', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' };
  return null;
};

// Formatea series, repeticiones y peso de un ejercicio (ej. "4×8-12 · 80 kg")
const formatExerciseMeta = (e) => {
  const sets = e.targetSets !== '' && e.targetSets !== undefined ? Number(e.targetSets) : null;
  const reps = e.targetReps ? String(e.targetReps).trim() : '';
  const weight = e.defaultWeight !== '' && e.defaultWeight !== undefined ? `${e.defaultWeight} kg` : '';
  const setsReps = sets && reps
    ? `${sets}×${reps}`
    : sets
      ? `${sets} ${sets === 1 ? 'serie' : 'series'}`
      : reps
        ? `${reps} reps`
        : '';
  return [setsReps, weight].filter(Boolean).join(' · ');
};

function RoutineEditor({ routine, onSelect }) {
  const { routines, saveRoutines } = useGym();
  const [name, setName] = useState(routine);
  const [exName, setExName] = useState('');
  const [muscle, setMuscle] = useState(MUSCLES[0]);
  const [targetSets, setTargetSets] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [defaultWeight, setDefaultWeight] = useState('');

  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', muscle: MUSCLES[0], targetSets: '', targetReps: '', defaultWeight: '' });

  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  useEffect(() => {
    setName(routine);
    setEditingIdx(null);
  }, [routine]);

  const list = routines[routine] || [];
  const update = (next) => saveRoutines({ ...routines, [routine]: next });

  const moveExercise = (from, to) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    update(next);
    if (editingIdx === from) setEditingIdx(to);
    else if (editingIdx !== null) setEditingIdx(null);
  };

  const startEditExercise = (idx) => {
    if (editingIdx === idx) {
      setEditingIdx(null);
      return;
    }
    const item = list[idx];
    setEditingIdx(idx);
    setEditForm({
      name: item.name || '',
      muscle: item.muscle || MUSCLES[0],
      targetSets: item.targetSets !== '' && item.targetSets !== undefined ? String(item.targetSets) : '',
      targetReps: item.targetReps || '',
      defaultWeight: item.defaultWeight !== '' && item.defaultWeight !== undefined ? String(item.defaultWeight) : '',
    });
  };

  const saveEditExercise = (idx) => {
    const clean = editForm.name.trim();
    if (!clean) return;
    const parsedSets = editForm.targetSets.trim() !== '' ? Math.max(1, Math.floor(Number(editForm.targetSets))) : '';
    const next = list.map((item, i) => (i !== idx ? item : {
      ...item,
      name: clean,
      muscle: editForm.muscle,
      targetSets: Number.isFinite(parsedSets) && parsedSets > 0 ? parsedSets : '',
      targetReps: editForm.targetReps.trim(),
      defaultWeight: editForm.defaultWeight.trim() !== '' ? Number(editForm.defaultWeight.replace(',', '.')) : '',
    }));
    update(next);
    setEditingIdx(null);
  };

  const addExercise = (event) => {
    event.preventDefault();
    if (!exName.trim()) return;
    const parsedSets = targetSets.trim() !== '' ? Math.max(1, Math.floor(Number(targetSets))) : '';
    update([...list, {
      name: exName.trim(),
      muscle,
      targetSets: Number.isFinite(parsedSets) && parsedSets > 0 ? parsedSets : '',
      targetReps: targetReps.trim(),
      defaultWeight: defaultWeight.trim() !== '' ? Number(defaultWeight.replace(',', '.')) : '',
    }]);
    setExName(''); setTargetSets(''); setTargetReps(''); setDefaultWeight('');
  };

  const rename = () => {
    const next = name.trim();
    if (!next || next === routine || routines[next]) { setName(routine); return; }
    saveRoutines(Object.fromEntries(Object.entries(routines).map(([k, v]) => [k === routine ? next : k, v])));
    onSelect(next);
  };

  const duplicateRoutine = () => {
    let copyName = `${routine} (copia)`;
    let k = 2;
    while (routines[copyName]) {
      copyName = `${routine} (${k})`;
      k += 1;
    }
    saveRoutines({ ...routines, [copyName]: list.map((e) => ({ ...e })) });
    onSelect(copyName);
  };

  const remove = () => {
    const rest = { ...routines };
    delete rest[routine];
    saveRoutines(rest);
    onSelect(Object.keys(rest)[0]);
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <label className={`mb-1.5 block text-[11px] font-bold uppercase tracking-wider ${muted}`}>Nombre de la rutina</label>
        <div className="flex items-center gap-2">
          <input aria-label="Nombre de la rutina" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} onBlur={rename} className={`${field} w-full min-w-0 font-bold`} />
          <button
            type="button"
            onClick={duplicateRoutine}
            title="Duplicar rutina"
            aria-label="Duplicar rutina"
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-200 text-zinc-800 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Orden y ejercicios ({list.length})</span>
          {list.length > 1 && <span className={`text-[11px] ${muted}`}>Usa ↑↓ o arrastra</span>}
        </div>

        {list.length === 0 ? (
          <p className={`rounded-2xl bg-zinc-200/60 p-4 text-center text-xs dark:bg-zinc-800/60 ${muted}`}>
            Añade ejercicios abajo para empezar a construir esta rutina.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((e, i) => {
              const isEditingThis = editingIdx === i;
              const isDragging = dragIdx === i;
              const isOver = overIdx === i && dragIdx !== null && dragIdx !== i;
              const meta = formatExerciseMeta(e);

              return (
                <li
                  key={`${e.name}-${i}`}
                  draggable={!isEditingThis}
                  onDragStart={() => setDragIdx(i)}
                  onDragOver={(ev) => { ev.preventDefault(); setOverIdx(i); }}
                  onDragLeave={() => setOverIdx(null)}
                  onDrop={(ev) => {
                    ev.preventDefault();
                    if (dragIdx !== null) moveExercise(dragIdx, i);
                    setDragIdx(null);
                    setOverIdx(null);
                  }}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                  className={`rounded-2xl bg-zinc-200/75 p-2.5 transition-all dark:bg-zinc-800/75 ${isDragging ? 'opacity-40' : ''} ${isOver ? 'ring-2 ring-zinc-950 dark:ring-white' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`cursor-grab touch-none pl-0.5 active:cursor-grabbing ${muted}`} aria-hidden="true">
                      <GripVertical size={15} />
                    </span>

                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-[11px] font-extrabold text-white dark:bg-white dark:text-zinc-950">
                      {String(i + 1).padStart(2, '0')}
                    </span>

                    <button
                      type="button"
                      onClick={() => startEditExercise(i)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-bold">{e.name}</p>
                      <p className={`truncate text-[11px] ${muted}`}>
                        {[e.muscle, meta].filter(Boolean).join(' · ')}
                      </p>
                    </button>

                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveExercise(i, i - 1)}
                        disabled={i === 0}
                        aria-label={`Subir ${e.name}`}
                        className="flex size-7 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-300 disabled:opacity-25 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveExercise(i, i + 1)}
                        disabled={i === list.length - 1}
                        aria-label={`Bajar ${e.name}`}
                        className="flex size-7 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-300 disabled:opacity-25 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditExercise(i)}
                        aria-label={`Editar ${e.name}`}
                        className={`flex size-7 items-center justify-center rounded-full transition-colors ${isEditingThis ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-zinc-600 hover:bg-zinc-300 dark:text-zinc-300 dark:hover:bg-zinc-700'}`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { update(list.filter((_, j) => j !== i)); setEditingIdx(null); }}
                        aria-label={`Quitar ${e.name}`}
                        className="flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {isEditingThis && (
                    <div className="mt-2.5 space-y-2 border-t border-zinc-300/80 pt-2.5 dark:border-zinc-700">
                      <div className="flex gap-2">
                        <input
                          aria-label="Editar nombre"
                          value={editForm.name}
                          onChange={(ev) => setEditForm((v) => ({ ...v, name: ev.target.value }))}
                          className={`${field} !h-9 w-full min-w-0 bg-white px-2.5 text-xs font-bold dark:bg-zinc-900`}
                        />
                        <select
                          aria-label="Editar músculo"
                          value={editForm.muscle}
                          onChange={(ev) => setEditForm((v) => ({ ...v, muscle: ev.target.value }))}
                          className={`${field} !h-9 shrink-0 bg-white px-2 text-xs dark:bg-zinc-900`}
                        >
                          {MUSCLES.map((m) => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          inputMode="numeric"
                          aria-label="Editar series"
                          placeholder="Series"
                          value={editForm.targetSets}
                          onChange={(ev) => setEditForm((v) => ({ ...v, targetSets: ev.target.value }))}
                          className={`${field} !h-9 w-full min-w-0 bg-white px-2 text-center text-xs font-semibold dark:bg-zinc-900`}
                        />
                        <input
                          aria-label="Editar repeticiones objetivo"
                          placeholder="Reps (8-12)"
                          value={editForm.targetReps}
                          onChange={(ev) => setEditForm((v) => ({ ...v, targetReps: ev.target.value }))}
                          className={`${field} !h-9 w-full min-w-0 bg-white px-2 text-center text-xs font-semibold dark:bg-zinc-900`}
                        />
                        <input
                          inputMode="decimal"
                          aria-label="Editar peso base"
                          placeholder="Kg"
                          value={editForm.defaultWeight}
                          onChange={(ev) => setEditForm((v) => ({ ...v, defaultWeight: ev.target.value }))}
                          className={`${field} !h-9 w-full min-w-0 bg-white px-2 text-center text-xs font-semibold dark:bg-zinc-900`}
                        />
                        <button
                          type="button"
                          onClick={() => saveEditExercise(i)}
                          aria-label="Guardar cambios"
                          className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-zinc-950 px-3 text-xs font-extrabold text-white dark:bg-white dark:text-zinc-950"
                        >
                          <Check size={14} /> OK
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <form onSubmit={addExercise} className="space-y-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
        <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Añadir ejercicio</p>
        <div className="flex gap-2">
          <input aria-label="Nuevo ejercicio" placeholder="Nombre del ejercicio" value={exName} onChange={(e) => setExName(e.target.value)} className={`${field} w-full min-w-0`} />
          <select aria-label="Músculo" value={muscle} onChange={(e) => setMuscle(e.target.value)} className={`${field} shrink-0 px-2`}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
        </div>
        <div className="flex gap-1.5">
          <input inputMode="numeric" aria-label="Series" placeholder="Series (ej: 4)" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} className={`${field} w-full min-w-0 px-2 text-center`} />
          <input aria-label="Baremo" placeholder="Reps (8-12)" value={targetReps} onChange={(e) => setTargetReps(e.target.value)} className={`${field} w-full min-w-0 px-2 text-center`} />
          <input inputMode="decimal" aria-label="Peso base" placeholder="Peso (kg)" value={defaultWeight} onChange={(e) => setDefaultWeight(e.target.value)} className={`${field} w-full min-w-0 px-2 text-center`} />
          <button type="submit" aria-label="Añadir ejercicio" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><Plus size={18} /></button>
        </div>
      </form>

      <button type="button" onClick={remove} disabled={Object.keys(routines).length < 2} className={`inline-flex items-center gap-1 text-sm font-semibold disabled:opacity-40 ${bad}`}>
        <Trash2 size={15} />Eliminar rutina
      </button>
    </div>
  );
}

function ImportRoutines({ onDone }) {
  const { routines, saveRoutines } = useGym();
  const [text, setText] = useState('');
  const [found, setFound] = useState(null);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);

  const analyze = () => {
    const result = parseRoutines(text);
    setError(result.length ? '' : 'No he encontrado ejercicios. Pon un ejercicio por línea, por ejemplo: Press banca 4x8 80kg.');
    setFound(result.length ? result : null);
  };
  const setMuscle = (r, i, muscle) => setFound((f) => f.map((x, a) => (a !== r ? x : { ...x, exercises: x.exercises.map((e, b) => (b !== i ? e : { ...e, muscle, review: false })) })));
  const save = () => {
    const base = replace ? {} : { ...routines };
    let first = null;
    found.forEach(({ name, exercises }) => {
      let n = name, k = 2;
      while (base[n]) { n = `${name} ${k}`; k += 1; }
      base[n] = exercises.map(({ review, ...e }) => e);
      first = first || n;
    });
    saveRoutines(base);
    onDone(first);
  };

  if (!found) {
    return (
      <div className="mt-4 space-y-3">
        <textarea aria-label="Texto de tu rutina" rows={9} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Empuje:\nPress banca 4x8 80kg\nPress militar 3x10\n\nTirón:\nDominadas 4x6'} className={`${field} h-auto w-full py-3`} />
        <p className={`text-xs ${muted}`}>Pega tu rutina de Notas. Pon cada día como título (termina en «:» o deja una línea en blanco antes) y un ejercicio por línea, con series×reps y kilos si quieres.</p>
        {error && <p role="alert" className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}
        <button type="button" onClick={analyze} disabled={!text.trim()} className={`${primary} !h-12`}>Reconocer rutina</button>
      </div>
    );
  }
  const total = found.reduce((t, r) => t + r.exercises.length, 0);
  return (
    <div className="mt-4 space-y-4">
      {found.map((r, ri) => (
        <div key={ri}>
          <p className="font-bold">{r.name}</p>
          <ul className="mt-2 space-y-2">
            {r.exercises.map((e, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.name}</span>
                  <span className={`text-xs ${muted}`}>{formatExerciseMeta(e) || 'Sin series ni peso'}</span>
                </span>
                <select aria-label={`Músculo de ${e.name}`} value={e.muscle} onChange={(ev) => setMuscle(ri, i, ev.target.value)} className={`${field} h-9 shrink-0 px-2 ${e.review ? 'ring-2 ring-amber-400' : ''}`}>{MUSCLES.map((m) => <option key={m}>{m}</option>)}</select>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className={`text-xs ${muted}`}>Revisa los músculos marcados en ámbar: no he podido deducirlos.</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} className="size-4 accent-zinc-950" />Reemplazar mis rutinas actuales</label>
      <div className="flex gap-2">
        <button type="button" onClick={() => setFound(null)} className="h-12 shrink-0 rounded-full bg-zinc-200 px-5 text-sm font-semibold dark:bg-zinc-800">Volver</button>
        <button type="button" onClick={save} className={`${primary} !h-12`}>Añadir {found.length} {found.length === 1 ? 'rutina' : 'rutinas'} ({total})</button>
      </div>
    </div>
  );
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function Activity({ sessions, activeDate }) {
  const [range, setRange] = useState('1S');
  const vol = (list) => list.reduce((t, s) => t + s.sets.reduce((u, x) => u + x.kg * x.reps, 0), 0);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const bars = range === '1S'
    ? DAYS.map((label, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const k = iso(d);
        return { label, v: vol(sessions.filter((s) => s.date === k)), on: k === activeDate };
      })
    : [3, 2, 1, 0].map((off) => ({ label: off ? `−${off} sem` : 'Esta', v: weekVol(sessions, off), on: off === 0 }));
  const top = Math.max(...bars.map((b) => b.v), 1);
  const avg = bars.reduce((t, b) => t + b.v, 0) / bars.length;
  const totalVol = bars.reduce((t, b) => t + b.v, 0);

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <TrendingUp size={15} />
          </span>
          <div>
            <h2 className="text-base font-bold leading-none tracking-tight">Actividad</h2>
            <p className={`mt-1 text-xs ${muted}`}>
              {totalVol > 0 ? `Media ${fmt(avg)} kg` : 'Sin volumen en este periodo'}
            </p>
          </div>
        </div>

        <div className="flex rounded-full bg-zinc-200/80 p-1 dark:bg-zinc-800">
          {[['1S', '1S'], ['1M', '1M']].map(([r, label]) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={`rounded-full px-3 py-1 text-xs font-extrabold transition-all ${
                range === r
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="relative flex h-32 items-end gap-2">
          {avg > 0 && (
            <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center border-t border-dashed border-zinc-400/70 dark:border-zinc-600" style={{ bottom: `${(avg / top) * 100}%` }}>
              <span className="-mt-4 rounded bg-zinc-100 px-1 text-[9px] font-bold uppercase tracking-wider text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                media
              </span>
            </div>
          )}
          {bars.map((b) => {
            const pct = b.v > 0 ? Math.max(10, (b.v / top) * 100) : 5;
            return (
              <div key={b.label} title={`${fmt(b.v)} kg`} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                {b.v > 0 && b.on && (
                  <span className="text-[10px] font-extrabold text-zinc-950 dark:text-white">
                    {b.v >= 1000 ? `${fmt(b.v / 1000, 1)}t` : fmt(b.v)}
                  </span>
                )}
                <div
                  className={`w-full rounded-2xl transition-all duration-300 ${
                    b.on
                      ? 'bg-zinc-950 dark:bg-white'
                      : b.v > 0
                        ? 'bg-zinc-300 dark:bg-zinc-700'
                        : 'bg-zinc-200/70 dark:bg-zinc-800/70'
                  }`}
                  style={{ height: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 flex gap-2">
          {bars.map((b) => (
            <span
              key={b.label}
              className={`flex-1 rounded-full py-0.5 text-center text-[11px] font-bold ${
                b.on
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : muted
              }`}
            >
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function Home({ go, routine, activeDate }) {
  const { sessions, routines, saveRoutines, meals = [], goals, draft } = useGym();
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);

  const done = sessions.filter((x) => x.date === activeDate);
  const week = weekVol(sessions, 0), prev = weekVol(sessions, 1);
  const delta = prev ? ((week - prev) / prev) * 100 : null;
  const streak = calcStreak(sessions);

  const exercises = routines[routine] || [];
  const musclesInRoutine = [...new Set(exercises.map((e) => e.muscle))];
  const plannedSetsTotal = exercises.reduce((t, e) => t + (Number(e.targetSets) || 0), 0);

  const dayMeals = meals.filter((m) => m.date === activeDate);
  const dayKcal = dayMeals.reduce((t, m) => t + m.kcal, 0);
  const kcalGoal = goals?.kcal || 2400;

  const create = () => {
    let n = 'Nueva rutina', i = 2;
    while (routines[n]) { n = `Nueva rutina ${i}`; i += 1; }
    saveRoutines({ ...routines, [n]: [] });
    go('inicio', n);
  };

  const hasActiveDraft = draft && Array.isArray(draft.sets) && draft.sets.length > 0;

  return (
    <div className="space-y-4">
      <Activity sessions={sessions} activeDate={activeDate} />

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col justify-between rounded-[26px] bg-zinc-950 p-4 text-white dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Racha</span>
            <Flame size={15} className="text-amber-400" />
          </div>
          <div className="my-2.5 flex items-baseline gap-1.5">
            <span className="text-4xl font-extrabold leading-none tracking-tight">{streak}</span>
            <span className="text-xs font-semibold text-zinc-400">{streak === 1 ? 'día' : 'días'}</span>
          </div>
          <div className="flex items-end justify-between pt-1 opacity-40" aria-hidden="true">
            {[4, 7, 4, 10, 4, 7, 4].map((h, idx) => (
              <span
                key={idx}
                className={`w-0.5 rounded-full ${streak > 0 && idx === 3 ? 'bg-white opacity-100' : 'bg-zinc-500'}`}
                style={{ height: `${h * 1.4}px` }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-[26px] bg-zinc-100 p-4 dark:bg-zinc-900">
          <div className="flex items-center justify-between gap-1">
            <span className={`truncate text-[11px] font-bold uppercase tracking-wider ${muted}`}>Semana</span>
            {delta !== null ? (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${delta < 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'}`}>
                {delta < 0 ? '−' : '+'}{fmt(Math.abs(delta), 0)}%
              </span>
            ) : (
              <Dumbbell size={14} className={muted} />
            )}
          </div>
          <div className="my-2.5 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold leading-none tracking-tight">{fmt(week)}</span>
            <span className={`text-xs font-bold ${muted}`}>kg</span>
          </div>
          <div className="flex items-end justify-between pt-1 opacity-40" aria-hidden="true">
            {[4, 7, 4, 10, 4, 7, 4].map((h, idx) => (
              <span
                key={idx}
                className={`w-0.5 rounded-full ${week > 0 && idx === 3 ? 'bg-zinc-950 opacity-100 dark:bg-white' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                style={{ height: `${h * 1.4}px` }}
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => go('dieta')}
          className="col-span-2 flex items-center justify-between gap-3 rounded-[24px] bg-zinc-100 p-3.5 text-left transition-colors hover:bg-zinc-200/70 dark:bg-zinc-900 dark:hover:bg-zinc-800/80"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-zinc-200/80 text-zinc-950 dark:bg-zinc-800 dark:text-white">
              <Utensils size={17} />
            </span>
            <div>
              <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Nutrición del día</p>
              <p className="mt-0.5 text-sm font-extrabold">
                {fmt(dayKcal)} <span className={`font-semibold ${muted}`}>/ {fmt(kcalGoal)} kcal</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16">
              <Bar value={(dayKcal / kcalGoal) * 100} />
            </div>
            <ChevronRight size={17} className={muted} />
          </div>
        </button>
      </div>

      {hasActiveDraft && (
        <button
          type="button"
          onClick={() => go('entreno', draft.routine)}
          className="flex w-full items-center justify-between gap-3 rounded-[24px] bg-zinc-950 px-4 py-3.5 text-left text-white transition-transform active:scale-[0.99] dark:bg-white dark:text-zinc-950"
        >
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15 dark:bg-zinc-950/10">
              <Zap size={17} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">Entreno en curso</p>
              <p className="text-sm font-extrabold">{draft.routine} · {draft.sets.length} {draft.sets.length === 1 ? 'serie' : 'series'}</p>
            </div>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-extrabold text-zinc-950 dark:bg-zinc-950 dark:text-white">
            Seguir →
          </span>
        </button>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-white">
              <Dumbbell size={15} />
            </span>
            <span className={`text-xs font-bold uppercase tracking-wider ${muted}`}>Rutina de entrenamiento</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setEditing(false); setImporting((v) => !v); }}
              aria-label="Importar rutina desde texto"
              aria-pressed={importing}
              className={`flex size-8 items-center justify-center rounded-full transition-colors ${importing ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
            >
              {importing ? <X size={15} /> : <FileText size={15} />}
            </button>
            <button
              type="button"
              onClick={() => { setImporting(false); setEditing((v) => !v); }}
              aria-label="Editar rutinas"
              aria-pressed={editing}
              className={`flex size-8 items-center justify-center rounded-full transition-colors ${editing ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
            >
              {editing ? <X size={15} /> : <Pencil size={15} />}
            </button>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {Object.keys(routines).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => go('inicio', r)}
              aria-pressed={r === routine}
              className={`rounded-full px-3.5 py-1.5 text-xs font-extrabold transition-colors ${
                r === routine
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-300'
              }`}
            >
              {r}
            </button>
          ))}
          {editing && (
            <button type="button" onClick={create} aria-label="Nueva rutina" className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Plus size={15} />
            </button>
          )}
        </div>

        {importing ? (
          <ImportRoutines onDone={(r) => { setImporting(false); go('inicio', r); }} />
        ) : editing ? (
          <RoutineEditor routine={routine} onSelect={(r) => go('inicio', r)} />
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-2">
              <div>
                <p className="text-3xl font-extrabold leading-none tracking-tight">{routine}</p>
                <p className={`mt-1.5 text-xs font-medium ${muted}`}>
                  {exercises.length} {exercises.length === 1 ? 'ejercicio' : 'ejercicios'}
                  {plannedSetsTotal > 0 && ` · ${plannedSetsTotal} series`}
                  {musclesInRoutine.length > 0 && ` · ${musclesInRoutine.join(' · ')}`}
                </p>
              </div>
            </div>

            {exercises.length === 0 ? (
              <p className={`mt-4 rounded-2xl bg-zinc-200/60 p-4 text-center text-sm dark:bg-zinc-800/60 ${muted}`}>
                Pulsa el lápiz de arriba para añadir ejercicios a esta rutina.
              </p>
            ) : (
              <ol className="mt-4 space-y-2">
                {exercises.map((e, idx) => {
                  const meta = formatExerciseMeta(e);
                  return (
                    <li key={e.name} className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-200/70 px-3.5 py-2.5 dark:bg-zinc-800/70">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`text-xs font-extrabold ${muted}`}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{e.name}</p>
                          {meta && <p className={`text-[11px] ${muted}`}>{meta}</p>}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {e.muscle}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}

            <button
              type="button"
              onClick={() => go('entreno')}
              disabled={!exercises.length}
              className={`${primary} mt-5 flex !h-12 items-center justify-center gap-2 !text-sm`}
            >
              <Zap size={16} />
              {hasActiveDraft && draft.routine === routine ? 'Continuar entreno' : 'Empezar entreno'}
            </button>
          </>
        )}
      </Card>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Entrenos realizados</h2>
          {done.length > 0 && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-900">
              {done.length} {done.length === 1 ? 'sesión' : 'sesiones'}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {done.length === 0 ? (
            <Card className="text-center">
              <Dumbbell size={20} className={`mx-auto ${muted}`} />
              <p className={`mt-2 text-sm ${muted}`}>Sin entrenos registrados este día.</p>
            </Card>
          ) : (
            done.map((x) => {
              const vol = x.sets.reduce((t, y) => t + y.kg * y.reps, 0);
              const prs = x.sets.filter((y) => y.pr).length;
              return (
                <button
                  key={x.id}
                  type="button"
                  onClick={() => go('progreso')}
                  className="flex w-full items-center justify-between gap-3 rounded-[24px] bg-zinc-100 p-3.5 text-left transition-colors hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                      <Check size={18} strokeWidth={2.5} />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{x.name}</p>
                        {prs > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                            <Flame size={10} />{prs} PR
                          </span>
                        )}
                      </div>
                      <p className={`mt-0.5 text-xs ${muted}`}>
                        {x.sets.length} series · <b className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(vol)} kg</b>
                        {x.duration > 0 && ` · ${formatMins(x.duration)}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={18} className={`shrink-0 ${muted}`} />
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

// ---- Sección de Amigos: conectar por código de amigo, ver rutina y progreso, y reaccionar con 5 emojis ----
const QUICK_EMOJIS = ['🔥', '💪', '👏', '⚡', '🏆'];

const getInitials = (name) => name
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((w) => w[0].toUpperCase())
  .join('') || 'AT';

const resolveFriendData = (f, localUsers) => {
  if (!f.userId) return f;
  try {
    const raw = JSON.parse(localStorage.getItem(`gym-data:${f.userId}`));
    const uMeta = localUsers.find((u) => u.id === f.userId);
    const liveCode = raw?.friendCode || uMeta?.friendCode || f.code || friendCodeOf({ id: f.userId });
    if (!raw) return { ...f, code: liveCode };

    const sessions = raw.sessions || [];
    const routines = raw.routines || {};
    const goals = raw.goals || {};
    const rName = todayRoutine(routines) || Object.keys(routines)[0] || 'Rutina';
    const exercises = routines[rName] || [];
    const counts = weekSets(sessions);
    const doneSets = Object.values(counts).reduce((t, n) => t + n, 0);
    const capTotal = Object.values(goals.weekly || {}).reduce((t, n) => t + n, 0) || 40;

    let best = null;
    sessions.forEach((s) => s.sets.forEach((x) => {
      if (x.type === 'W') return;
      const est = e1rm(x.kg, x.reps);
      if (!best || est > best.kg) best = { ex: x.ex, kg: Math.round(est) };
    }));

    const lastSession = [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0];
    const status = lastSession
      ? `${lastSession.date === iso() ? 'Hoy' : shortDate(lastSession.date)} · ${lastSession.name}`
      : 'Conectado por código';

    return {
      ...f,
      code: liveCode,
      status,
      streak: calcStreak(sessions),
      weeklyVol: weekVol(sessions, 0),
      prevWeekVol: weekVol(sessions, 1),
      weeklySets: doneSets,
      weeklyCap: capTotal,
      topLift: best,
      routineName: rName,
      exercises,
      baseReactions: f.baseReactions || {},
    };
  } catch {
    return f;
  }
};

export function Friends() {
  const { user, friendCode, regenerateFriendCode, friends = [], reactions = {}, addFriend, removeFriend, toggleReaction, routines, saveRoutines } = useGym();
  const [connectOpen, setConnectOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [savedRoutineId, setSavedRoutineId] = useState('');

  const myCode = friendCode || friendCodeOf(user);

  const localUsers = (() => {
    try { return JSON.parse(localStorage.getItem('gym-users')) || []; } catch { return []; }
  })();
  const otherLocalUsers = localUsers.filter(
    (u) => u.id !== user.id && !friends.some((f) => f.userId === u.id)
  );

  const hydratedFriends = friends.map((f) => resolveFriendData(f, localUsers));

  const copyMyCode = async () => {
    const shareMsg = `Conecta conmigo en la app con mi código de amigo: ${myCode}`;
    try {
      await navigator.clipboard?.writeText(myCode);
    } catch { /* ignorar */ }
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    if (navigator.share) {
      navigator.share({ title: 'Mi código de amigo', text: shareMsg }).catch(() => {});
    }
  };

  const normalizeCode = (raw) => {
    const clean = raw.trim().toUpperCase();
    return clean.startsWith('GYM-') ? clean : `GYM-${clean.replace(/^GYM-?/i, '')}`;
  };

  const handleConnect = (e) => {
    e.preventDefault();
    const raw = query.trim();
    if (!raw) return;
    setFeedback('');

    const normalized = normalizeCode(raw);
    if (normalized === myCode.toUpperCase()) {
      setFeedback('Ese es tu propio código de amigo.');
      return;
    }

    const matched = localUsers.find((u) => {
      const uCode = friendCodeOf(u).toUpperCase();
      return uCode === normalized || u.id.toUpperCase() === raw.toUpperCase();
    });

    if (matched) {
      if (friends.some((f) => f.userId === matched.id)) {
        setFeedback('Ya estás conectado con ese código.');
        return;
      }
      addFriend({
        id: `u-${matched.id}`,
        userId: matched.id,
        name: matched.name,
        code: friendCodeOf(matched),
        baseReactions: {},
      });
      setQuery('');
      setConnectOpen(false);
      return;
    }

    const validCode = /^GYM-[A-Z0-9]{4,8}$/.test(normalized);
    if (!validCode) {
      setFeedback('Introduce un código válido (ej. GYM-A1B2C3).');
      return;
    }

    if (friends.some((f) => f.code?.toUpperCase() === normalized)) {
      setFeedback('Ya tienes añadido este código de amigo.');
      return;
    }

    const suffix = normalized.slice(4);
    addFriend({
      id: `ext-${crypto.randomUUID()}`,
      name: `Atleta #${suffix}`,
      code: normalized,
      status: 'Conectado hoy · Torso',
      streak: 5,
      weeklyVol: 11200,
      prevWeekVol: 10400,
      weeklySets: 34,
      weeklyCap: 45,
      topLift: { ex: 'Press banca', kg: 88 },
      routineName: 'Torso Completo',
      exercises: [
        { name: 'Press inclinado', muscle: 'Pecho', targetSets: 3, targetReps: '8', defaultWeight: 70 },
        { name: 'Dominadas', muscle: 'Espalda', targetSets: 4, targetReps: '8', defaultWeight: '' },
        { name: 'Remo en polea', muscle: 'Espalda', targetSets: 3, targetReps: '12', defaultWeight: 60 },
      ],
      baseReactions: { '🔥': 1, '💪': 2 },
    });
    setQuery('');
    setConnectOpen(false);
  };

  const linkLocalUser = (u) => {
    addFriend({
      id: `u-${u.id}`,
      userId: u.id,
      name: u.name,
      code: friendCodeOf(u),
      baseReactions: {},
    });
  };

  const copyFriendRoutine = (f) => {
    if (!f.exercises?.length) return;
    const baseName = f.routineName || `Rutina de ${f.name.split(' ')[0]}`;
    let finalName = baseName;
    let k = 2;
    while (routines[finalName]) {
      finalName = `${baseName} (${k})`;
      k += 1;
    }
    saveRoutines({ ...routines, [finalName]: f.exercises });
    setSavedRoutineId(f.id);
    setTimeout(() => setSavedRoutineId(''), 2200);
  };

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Users size={17} />
            </span>
            <div>
              <h2 className="text-base font-bold leading-none tracking-tight">Comunidad</h2>
              <p className={`mt-1 text-xs ${muted}`}>
                {hydratedFriends.length} {hydratedFriends.length === 1 ? 'amigo conectado' : 'amigos conectados'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => { setFeedback(''); setConnectOpen((v) => !v); }}
            aria-expanded={connectOpen}
            className={`inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-xs font-extrabold transition-colors ${
              connectOpen
                ? 'bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-white'
                : 'bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200'
            }`}
          >
            {connectOpen ? <X size={15} /> : <UserPlus size={15} />}
            {connectOpen ? 'Cerrar' : 'Conectar'}
          </button>
        </div>

        <div className="mt-3.5 flex items-center justify-between gap-2 rounded-2xl bg-zinc-200/70 px-3.5 py-2.5 dark:bg-zinc-800/70">
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Tu código de amigo</p>
            <p className="mt-0.5 font-mono text-sm font-extrabold tracking-wider">{myCode}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={regenerateFriendCode}
              aria-label="Generar nuevo código de amigo"
              title="Generar nuevo código"
              className="flex size-8 items-center justify-center rounded-full bg-white text-zinc-700 transition-colors hover:bg-zinc-300 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <RefreshCw size={13} />
            </button>
            <button
              type="button"
              onClick={copyMyCode}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-950 px-3 text-[11px] font-extrabold text-white dark:bg-white dark:text-zinc-950"
            >
              {copiedCode ? <Check size={12} /> : <Share2 size={12} />}
              {copiedCode ? 'Copiado' : 'Compartir'}
            </button>
          </div>
        </div>

        {connectOpen && (
          <div className="mt-3.5 space-y-3 border-t border-zinc-200 pt-3.5 dark:border-zinc-800">
            <form onSubmit={handleConnect} className="flex gap-2">
              <input
                aria-label="Código de amigo"
                placeholder="Introduce código (ej. GYM-A1B2C3)"
                value={query}
                onChange={(e) => setQuery(e.target.value.toUpperCase())}
                maxLength={12}
                className={`${field} w-full min-w-0 font-mono uppercase`}
              />
              <button type="submit" disabled={!query.trim()} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950">
                <Plus size={18} />
              </button>
            </form>

            {feedback && (
              <p role="status" className="text-xs font-semibold text-rose-600 dark:text-rose-400">{feedback}</p>
            )}

            {otherLocalUsers.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>Perfiles en este dispositivo</p>
                {otherLocalUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-2xl bg-zinc-200/60 px-3 py-2 dark:bg-zinc-800/60">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{u.name}</p>
                      <p className={`truncate font-mono text-[11px] ${muted}`}>{friendCodeOf(u)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => linkLocalUser(u)}
                      className="rounded-full bg-zinc-950 px-3 py-1 text-[11px] font-extrabold text-white dark:bg-white dark:text-zinc-950"
                    >
                      Conectar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {hydratedFriends.length === 0 ? (
        <Card className="text-center">
          <Users size={22} className={`mx-auto ${muted}`} />
          <p className="mt-2 text-sm font-bold">Aún no tienes amigos conectados</p>
          <p className={`mt-1 text-xs ${muted}`}>Comparte tu código de amigo o introduce el suyo para ver su rutina y progreso.</p>
          <button
            type="button"
            onClick={() => setConnectOpen(true)}
            className={`${primary} mt-4 !h-11 !text-sm`}
          >
            Añadir código de amigo
          </button>
        </Card>
      ) : (
        <div className="space-y-4">
          {hydratedFriends.map((f) => {
            const delta = f.prevWeekVol ? ((f.weeklyVol - f.prevWeekVol) / f.prevWeekVol) * 100 : null;
            const myReacts = reactions[f.id] || {};
            const isExpanded = expandedId === f.id;
            const visibleExercises = isExpanded ? (f.exercises || []) : (f.exercises || []).slice(0, 3);
            const hasMore = (f.exercises || []).length > 3;

            return (
              <Card key={f.id} className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-extrabold text-white dark:bg-white dark:text-zinc-950">
                      {getInitials(f.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-extrabold">{f.name}</p>
                        {f.code && (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 font-mono text-[10px] font-bold dark:bg-zinc-800">
                            {f.code}
                          </span>
                        )}
                      </div>
                      <p className={`truncate text-xs ${muted}`}>{f.status}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-extrabold text-amber-600 dark:text-amber-400">
                      <Flame size={12} />{f.streak}d
                    </span>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(`¿Dejar de seguir a ${f.name}?`)) removeFriend(f.id); }}
                      aria-label={`Eliminar a ${f.name}`}
                      className={trash}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-zinc-200/70 p-3 dark:bg-zinc-800/70">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Volumen sem.</span>
                      {delta !== null && (
                        <span className={`text-[10px] font-extrabold ${delta < 0 ? bad : ''}`}>
                          {delta < 0 ? '−' : '+'}{fmt(Math.abs(delta), 0)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xl font-extrabold leading-none tracking-tight">
                      {fmt(f.weeklyVol)} <span className={`text-xs font-bold ${muted}`}>kg</span>
                    </p>
                    <div className="mt-2">
                      <Bar value={f.weeklyCap ? (f.weeklySets / f.weeklyCap) * 100 : Math.min(100, f.weeklySets * 3)} />
                    </div>
                  </div>

                  <div className="flex flex-col justify-between rounded-2xl bg-zinc-200/70 p-3 dark:bg-zinc-800/70">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Mejor marca</span>
                      <Zap size={12} className={muted} />
                    </div>
                    {f.topLift ? (
                      <div className="mt-1">
                        <p className="text-xl font-extrabold leading-none tracking-tight">
                          {fmt(f.topLift.kg)} <span className={`text-xs font-bold ${muted}`}>kg</span>
                        </p>
                        <p className={`mt-1 truncate text-[11px] font-medium ${muted}`}>{f.topLift.ex}</p>
                      </div>
                    ) : (
                      <p className={`mt-2 text-xs ${muted}`}>{f.weeklySets} series esta sem.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl bg-zinc-200/50 p-3.5 dark:bg-zinc-800/50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Dumbbell size={14} className={muted} />
                      <p className="truncate text-xs font-extrabold uppercase tracking-wider">
                        Rutina · {f.routineName}
                      </p>
                    </div>
                    {(f.exercises || []).length > 0 && (
                      <button
                        type="button"
                        onClick={() => copyFriendRoutine(f)}
                        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-zinc-950 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-700"
                      >
                        {savedRoutineId === f.id ? <Check size={11} /> : <Copy size={11} />}
                        {savedRoutineId === f.id ? '¡Guardada!' : 'Copiar'}
                      </button>
                    )}
                  </div>

                  {visibleExercises.length === 0 ? (
                    <p className={`mt-2 text-xs ${muted}`}>Sin ejercicios configurados.</p>
                  ) : (
                    <ul className="mt-2.5 space-y-1.5">
                      {visibleExercises.map((ex, i) => {
                        const meta = formatExerciseMeta(ex);
                        return (
                          <li key={i} className="flex items-center justify-between text-xs">
                            <span className="truncate font-semibold">
                              {ex.name}
                              {meta && <span className={`ml-1.5 font-normal ${muted}`}>({meta})</span>}
                            </span>
                            <span className={`ml-2 shrink-0 text-[11px] font-bold ${muted}`}>{ex.muscle}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : f.id)}
                      className={`mt-2 inline-flex items-center gap-1 text-[11px] font-bold ${muted}`}
                    >
                      {isExpanded ? <><ChevronUp size={13} /> Ver menos</> : <><ChevronDown size={13} /> Ver {f.exercises.length - 3} más</>}
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1.5 pt-0.5">
                  {QUICK_EMOJIS.map((emoji) => {
                    const active = !!myReacts[emoji];
                    const count = (f.baseReactions?.[emoji] || 0) + (active ? 1 : 0);
                    return (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => toggleReaction(f.id, emoji)}
                        aria-pressed={active}
                        aria-label={`Reaccionar con ${emoji}`}
                        className={`flex h-10 flex-1 items-center justify-center gap-1 rounded-2xl text-sm font-extrabold transition-all active:scale-95 ${
                          active
                            ? 'bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950'
                            : 'bg-zinc-200/80 text-zinc-700 hover:bg-zinc-300/80 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <span className="text-base leading-none">{emoji}</span>
                        {count > 0 && <span className="text-xs">{count}</span>}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Valores que se rellenan solos al elegir un ejercicio: lo configurado en la rutina y, si no hay, lo último que hiciste.
const startValues = (ex, last) => ({
  kg: ex && ex.defaultWeight !== '' && ex.defaultWeight !== undefined ? String(ex.defaultWeight) : last ? String(last.kg) : '',
  reps: ex?.targetReps ? String(ex.targetReps).split('×').pop().match(/\d+/)?.[0] || '' : (last ? String(last.reps) : ''),
});

const ITEM = 64, MAX_REPS = 60;
// Regla deslizable: arrastra y se ajusta al número del centro.
function RepsPicker({ value, onChange }) {
  const ref = useRef(null);
  const fromScroll = useRef(false);
  const v = Math.min(MAX_REPS, Math.max(1, value));
  useEffect(() => {
    if (fromScroll.current) { fromScroll.current = false; return; }
    ref.current?.scrollTo({ left: (v - 1) * ITEM });
  }, [v]);
  const onScroll = (e) => {
    const n = Math.min(MAX_REPS, Math.max(1, Math.round(e.currentTarget.scrollLeft / ITEM) + 1));
    if (n !== v) { fromScroll.current = true; onChange(n); }
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') onChange(Math.min(MAX_REPS, v + 1));
    if (e.key === 'ArrowLeft') onChange(Math.max(1, v - 1));
  };
  return (
    <div ref={ref} onScroll={onScroll} onKeyDown={onKey} tabIndex={0} role="slider" aria-label="Repeticiones" aria-valuemin={1} aria-valuemax={MAX_REPS} aria-valuenow={v}
      className="mt-5 flex snap-x snap-mandatory items-end overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_25%,black_75%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ paddingInline: `calc(50% - ${ITEM / 2}px)` }}>
      {Array.from({ length: MAX_REPS }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" tabIndex={-1} onClick={() => onChange(n)} aria-label={`${n} repeticiones`} className="flex shrink-0 snap-center flex-col items-center" style={{ width: ITEM }}>
          <span className={n === v ? 'text-5xl font-extrabold leading-none' : `text-sm ${muted}`}>{n}</span>
          <span className={`mt-2 w-0.5 rounded bg-zinc-950 dark:bg-white ${n === v ? 'h-10' : 'h-5 opacity-30'}`} />
        </button>
      ))}
    </div>
  );
}

export function Workout({ routine, go, activeDate }) {
  const { addSession, sessions, routines, saveRoutines, draft, saveDraft, user, friendCode, exerciseNotes = {}, saveExerciseNote } = useGym();
  const baseExercises = routines[routine] || [];
  const activeDraft = draft?.routine === routine && draft.date === activeDate ? draft : null;

  // Cronómetro total de la sesión (persiste en draft si recargas la página)
  const [startedAt] = useState(() => activeDraft?.startedAt || Date.now());
  const [elapsed, setElapsed] = useState(() => Math.floor((Date.now() - (activeDraft?.startedAt || Date.now())) / 1000));

  // Lista editable y reordenable de ejercicios para la sesión actual
  const [sessionExercises, setSessionExercises] = useState(() => {
    if (activeDraft?.exercises?.length) return activeDraft.exercises;
    if (activeDraft?.sets?.length) {
      const seen = new Set(baseExercises.map((e) => e.name));
      const extras = [];
      activeDraft.sets.forEach((s) => {
        if (!seen.has(s.ex)) {
          seen.add(s.ex);
          extras.push({ name: s.ex, muscle: s.muscle || MUSCLES[0] });
        }
      });
      return [...baseExercises, ...extras];
    }
    return baseExercises;
  });

  const [name, setName] = useState(() => sessionExercises[0]?.name || '');
  const [sets, setSets] = useState(() => activeDraft?.sets || []);
  const [input, setInput] = useState({ kg: '', reps: '' });
  const [setType, setSetType] = useState(''); // '' = Normal, 'W' = Calentamiento, 'D' = Drop-set, 'F' = Al fallo
  const [rir, setRir] = useState(''); // '', '0', '1', '2', '3+'
  const [rest, setRest] = useState(0);
  const [targetRest, setTargetRest] = useState(90);
  const [finishedSession, setFinishedSession] = useState(null);
  const [shareStatus, setShareStatus] = useState('');

  // Notas fijas por ejercicio
  const [localNotes, setLocalNotes] = useState({});
  const allNotes = { ...localNotes, ...exerciseNotes };
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(() => allNotes[sessionExercises[0]?.name || ''] || '');

  // Panel de organizar ejercicios durante el entreno
  const [organizing, setOrganizing] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraMuscle, setExtraMuscle] = useState(MUSCLES[0]);
  const [extraSets, setExtraSets] = useState('');
  const [orderSavedNotice, setOrderSavedNotice] = useState(false);

  // Edición en línea de una serie ya registrada
  const [editingSetIdx, setEditingSetIdx] = useState(null);
  const [editSetForm, setEditSetForm] = useState({ kg: '', reps: '', type: '', rir: '' });

  const wasResting = useRef(false);

  const myCode = friendCode || friendCodeOf(user);
  const currentEx = sessionExercises.find((e) => e.name === name);
  const hasBase = currentEx?.defaultWeight !== '' && currentEx?.defaultWeight !== undefined;
  const last = [...sessions].reverse().flatMap((x) => [...x.sets].reverse()).find((x) => x.ex === name && x.type !== 'W')
    || [...sessions].reverse().flatMap((x) => [...x.sets].reverse()).find((x) => x.ex === name);
  const bestBefore = Math.max(0, ...sessions.flatMap((x) => x.sets).filter((x) => x.ex === name && x.type !== 'W').map((x) => e1rm(x.kg, x.reps)));
  const mine = sets.map((x, idx) => ({ ...x, idx })).filter((x) => x.ex === name);
  const effectiveMine = mine.filter((x) => x.type !== 'W');
  const warmupCount = mine.length - effectiveMine.length;
  const reps = Number(input.reps) || last?.reps || 10;
  const completedCount = sessionExercises.filter((e) => sets.some((x) => x.ex === e.name && x.type !== 'W')).length;
  const sessionVol = sets.reduce((t, x) => t + x.kg * x.reps, 0);
  const effectiveTotalSets = sets.filter((x) => x.type !== 'W').length;

  useEffect(() => {
    setInput(startValues(currentEx, last));
    setEditingSetIdx(null);
    setEditingNote(false);
    setNoteDraft(allNotes[name] || '');
  }, [name]);

  useEffect(() => {
    if (!editingNote) setNoteDraft(allNotes[name] || '');
  }, [exerciseNotes, localNotes, name, editingNote]);

  // Cronómetro total en vivo
  useEffect(() => {
    if (finishedSession) return undefined;
    const timerId = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, [startedAt, finishedSession]);

  // Descanso: cuenta atrás y vibración al terminar.
  useEffect(() => {
    if (rest > 0) {
      wasResting.current = true;
      const t = setTimeout(() => setRest((r) => r - 1), 1000);
      return () => clearTimeout(t);
    }
    if (wasResting.current) { wasResting.current = false; navigator.vibrate?.([200, 100, 200]); }
    return undefined;
  }, [rest]);

  const commit = (nextSets, nextExercises = sessionExercises) => {
    setSets(nextSets);
    const hasCustomOrder = JSON.stringify(nextExercises) !== JSON.stringify(baseExercises);
    saveDraft(nextSets.length || hasCustomOrder ? { routine, date: activeDate, sets: nextSets, exercises: nextExercises, startedAt } : null);
  };

  const handleSaveExerciseNote = (e) => {
    e?.preventDefault();
    if (!name) return;
    if (saveExerciseNote) {
      saveExerciseNote(name, noteDraft);
    } else {
      setLocalNotes((prev) => {
        const next = { ...prev };
        const clean = noteDraft.trim();
        if (clean) next[name] = clean;
        else delete next[name];
        return next;
      });
    }
    setEditingNote(false);
  };

  const moveSessionExercise = (from, to) => {
    if (to < 0 || to >= sessionExercises.length || from === to) return;
    const next = [...sessionExercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setSessionExercises(next);
    commit(sets, next);
  };

  const addExtraExercise = (e) => {
    e.preventDefault();
    const clean = extraName.trim();
    if (!clean) return;
    const parsedSets = extraSets.trim() !== '' ? Math.max(1, Math.floor(Number(extraSets))) : '';
    const existing = sessionExercises.find((x) => x.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
      setName(existing.name);
    } else {
      const next = [...sessionExercises, {
        name: clean,
        muscle: extraMuscle,
        targetSets: Number.isFinite(parsedSets) && parsedSets > 0 ? parsedSets : '',
      }];
      setSessionExercises(next);
      setName(clean);
      commit(sets, next);
    }
    setExtraName('');
    setExtraSets('');
  };

  const removeSessionExercise = (idx) => {
    const target = sessionExercises[idx];
    if (!target || sets.some((s) => s.ex === target.name)) return;
    const next = sessionExercises.filter((_, i) => i !== idx);
    setSessionExercises(next);
    if (name === target.name) setName(next[0]?.name || '');
    commit(sets, next);
  };

  const orderChanged = JSON.stringify(sessionExercises) !== JSON.stringify(baseExercises);
  const saveOrderToRoutine = () => {
    saveRoutines({ ...routines, [routine]: sessionExercises });
    setOrderSavedNotice(true);
    setTimeout(() => setOrderSavedNotice(false), 2000);
  };

  const push = (kg, r, customType = setType, customRir = rir) => {
    if (!name || !(kg >= 0) || !(r > 0)) return;
    const isWarmup = customType === 'W';
    const prior = Math.max(bestBefore, ...sets.filter((x) => x.ex === name && x.type !== 'W').map((x) => e1rm(x.kg, x.reps)));
    const pr = !isWarmup && bestBefore > 0 && e1rm(kg, r) > prior;
    commit([
      ...sets,
      {
        ex: name,
        muscle: currentEx?.muscle,
        kg,
        reps: r,
        ...(customType && { type: customType }),
        ...(customRir && { rir: customRir }),
        ...(pr && { pr: true }),
      },
    ]);
    setRest(90);
    setTargetRest(90);
  };

  const add = (event) => {
    event.preventDefault();
    const typed = input.kg.trim();
    const kg = typed !== '' ? Number(typed.replace(',', '.')) : hasBase ? Number(currentEx.defaultWeight) : last?.kg;
    push(kg, reps, setType, rir);
  };

  const addQuickSet = () => {
    const lastMine = mine.at(-1);
    if (lastMine) {
      push(lastMine.kg, lastMine.reps, lastMine.type || '', lastMine.rir || '');
      return;
    }
    const typed = input.kg.trim();
    const kg = typed !== '' ? Number(typed.replace(',', '.')) : hasBase ? Number(currentEx.defaultWeight) : (last?.kg ?? 0);
    push(Number.isFinite(kg) ? kg : 0, reps, setType, rir);
  };

  const startEditSet = (setObj) => {
    if (editingSetIdx === setObj.idx) {
      setEditingSetIdx(null);
      return;
    }
    setEditingSetIdx(setObj.idx);
    setEditSetForm({
      kg: String(setObj.kg),
      reps: String(setObj.reps),
      type: setObj.type || '',
      rir: setObj.rir || '',
    });
  };

  const saveEditSet = (idx) => {
    const kg = Number(String(editSetForm.kg).replace(',', '.'));
    const r = Math.floor(Number(editSetForm.reps));
    if (!(kg >= 0) || !(r > 0)) return;
    const isWarmup = editSetForm.type === 'W';
    const next = sets.map((item, i) => {
      if (i !== idx) return item;
      const pr = !isWarmup && bestBefore > 0 && e1rm(kg, r) > bestBefore;
      return {
        ex: item.ex,
        muscle: item.muscle,
        kg,
        reps: r,
        ...(editSetForm.type && { type: editSetForm.type }),
        ...(editSetForm.rir && { rir: editSetForm.rir }),
        ...(pr && { pr: true }),
      };
    });
    commit(next);
    setEditingSetIdx(null);
  };

  const stepKg = (delta) => {
    const typed = input.kg.trim();
    const base = typed !== '' ? Number(typed.replace(',', '.')) : hasBase ? Number(currentEx.defaultWeight) : (last?.kg ?? 0);
    const next = Math.max(0, Math.round(((Number.isFinite(base) ? base : 0) + delta) * 10) / 10);
    setInput((v) => ({ ...v, kg: String(next) }));
  };

  const adjustRest = (amount) => {
    setRest((r) => Math.max(0, r + amount));
    setTargetRest((t) => Math.max(15, t + amount));
  };

  const finish = () => {
    const finalDuration = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const completed = { date: activeDate || iso(), name: routine, sets, duration: finalDuration };
    addSession(completed);
    setRest(0);
    setSets([]);
    setFinishedSession(completed);
  };

  // Pantalla de resumen y compartir al terminar el entreno
  if (finishedSession) {
    const totalVol = finishedSession.sets.reduce((t, x) => t + x.kg * x.reps, 0);
    const effectiveCompleted = finishedSession.sets.filter((x) => x.type !== 'W').length;
    const prCount = finishedSession.sets.filter((x) => x.pr).length;
    const groupedExercises = [...new Set(finishedSession.sets.map((x) => x.ex))].map((exName) => {
      const exSets = finishedSession.sets.filter((x) => x.ex === exName);
      const workingSets = exSets.filter((x) => x.type !== 'W');
      const pool = workingSets.length ? workingSets : exSets;
      const topSet = pool.reduce((best, cur) => (cur.kg * cur.reps > best.kg * best.reps ? cur : best), pool[0]);
      const hasPr = exSets.some((x) => x.pr);
      return { name: exName, count: exSets.length, workingCount: workingSets.length, topSet, hasPr };
    });

    const shareWorkout = async () => {
      const lines = [
        `💪 Entreno completado: ${finishedSession.name}`,
        `📅 ${shortDate(finishedSession.date)} · ⏱️ ${formatMins(finishedSession.duration)} · ${effectiveCompleted} series · ${fmt(totalVol)} kg`,
        ...groupedExercises.map(
          (g) => `• ${g.name}: ${g.workingCount || g.count} ${g.workingCount === 1 ? 'serie' : 'series'} (mejor: ${fmt(g.topSet.kg, 1)} kg × ${g.topSet.reps}${g.topSet.rir ? ` · RIR ${g.topSet.rir}` : ''})${g.hasPr ? ' 🏆' : ''}`
        ),
        '',
        `Conecta conmigo usando mi código de amigo: ${myCode}`,
      ];
      const text = lines.join('\n');

      try {
        await navigator.clipboard?.writeText(text);
        setShareStatus('¡Entreno copiado para compartir!');
      } catch {
        setShareStatus('Listo para compartir');
      }

      if (navigator.share) {
        try {
          await navigator.share({ title: `Entreno · ${finishedSession.name}`, text });
          setShareStatus('¡Entreno compartido!');
        } catch { /* el usuario cerró el diálogo nativo */ }
      }
      setTimeout(() => setShareStatus(''), 3000);
    };

    return (
      <div className="space-y-4">
        <Card className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
            <Trophy size={26} />
          </div>
          <p className={`mt-3 text-xs font-bold uppercase tracking-wider ${muted}`}>Sesión guardada</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">¡Entreno completado!</h2>
          <p className={`mt-1 text-sm font-medium ${muted}`}>
            {finishedSession.name} · {shortDate(finishedSession.date)} · {formatMins(finishedSession.duration)}
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-zinc-200/70 p-3 dark:bg-zinc-800/70">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Volumen</p>
              <p className="mt-1 text-lg font-extrabold leading-none">{fmt(totalVol)} <span className="text-xs">kg</span></p>
            </div>
            <div className="rounded-2xl bg-zinc-200/70 p-3 dark:bg-zinc-800/70">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Duración</p>
              <p className="mt-1 text-lg font-extrabold leading-none">{formatMins(finishedSession.duration)}</p>
            </div>
            <div className="rounded-2xl bg-zinc-200/70 p-3 dark:bg-zinc-800/70">
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Récords</p>
              <p className="mt-1 text-lg font-extrabold leading-none">{prCount}</p>
            </div>
          </div>

          <ul className="mt-4 space-y-2 text-left">
            {groupedExercises.map((g) => (
              <li key={g.name} className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-200/50 px-3.5 py-2.5 text-xs dark:bg-zinc-800/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate font-bold">{g.name}</p>
                    {g.hasPr && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                        <Flame size={10} /> PR
                      </span>
                    )}
                  </div>
                  <p className={`mt-0.5 ${muted}`}>{g.workingCount || g.count} {(g.workingCount || g.count) === 1 ? 'serie' : 'series'}</p>
                </div>
                <span className="shrink-0 font-extrabold">
                  {fmt(g.topSet.kg, 1)} kg × {g.topSet.reps}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between rounded-2xl border border-zinc-200 px-3.5 py-2.5 text-left dark:border-zinc-800">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${muted}`}>Tu código de amigo</p>
              <p className="font-mono text-xs font-extrabold">{myCode}</p>
            </div>
            <span className={`text-[11px] font-semibold ${muted}`}>Se incluye al compartir</span>
          </div>

          <button
            type="button"
            onClick={shareWorkout}
            className={`${primary} mt-5 flex !h-12 items-center justify-center gap-2 !text-sm`}
          >
            <Share2 size={17} />
            Compartir entreno
          </button>

          {shareStatus && (
            <p role="status" className="mt-2.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
              {shareStatus}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => go('inicio')}
              className="h-11 rounded-full bg-zinc-200 text-xs font-extrabold text-zinc-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              Ir a Inicio
            </button>
            <button
              type="button"
              onClick={() => go('progreso')}
              className="h-11 rounded-full bg-zinc-200 text-xs font-extrabold text-zinc-900 transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700"
            >
              Ver progreso
            </button>
          </div>
        </Card>
      </div>
    );
  }

  const typedKg = input.kg.trim();
  const resolvedKg = typedKg !== '' ? Number(typedKg.replace(',', '.')) : hasBase ? Number(currentEx.defaultWeight) : last?.kg;
  const preview1rm = Number.isFinite(resolvedKg) && resolvedKg > 0 && reps > 0 ? e1rm(resolvedKg, reps) : 0;
  const currentBest = Math.max(bestBefore, ...sets.filter((x) => x.ex === name && x.type !== 'W').map((x) => e1rm(x.kg, x.reps)));
  const willBePr = setType !== 'W' && bestBefore > 0 && preview1rm > currentBest;
  const targetMeta = currentEx ? formatExerciseMeta(currentEx) : '';
  const currentPersistentNote = allNotes[name] || '';

  return (
    <div className="space-y-4">
      <Card className="!p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                <Dumbbell size={11} />
              </span>
              <span className={`truncate text-xs font-bold uppercase tracking-wider ${muted}`}>{routine}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-zinc-200/80 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200" title="Duración total del entreno">
                <Clock size={10} />
                {formatDur(elapsed)}
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold leading-none tracking-tight">
                {completedCount}<span className={`text-lg font-bold ${muted}`}>/{sessionExercises.length}</span>
              </span>
              <span className={`text-xs font-semibold ${muted}`}>ejercicios</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOrganizing((v) => !v)}
              aria-expanded={organizing}
              aria-label="Organizar ejercicios"
              title="Reordenar o añadir ejercicios"
              className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold transition-colors ${
                organizing
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : 'bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {organizing ? <X size={15} /> : <SlidersHorizontal size={15} />}
              <span className="hidden sm:inline">{organizing ? 'Listo' : 'Orden'}</span>
            </button>

            <button
              type="button"
              onClick={finish}
              disabled={!sets.length}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white transition-all hover:bg-zinc-800 disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
            >
              <Check size={16} strokeWidth={2.5} />
              Terminar
            </button>
          </div>
        </div>

        {sessionExercises.length > 0 && (
          <div className="mt-3.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${sessionExercises.length}, minmax(0, 1fr))` }} aria-hidden="true">
            {sessionExercises.map((e) => {
              const done = sets.some((x) => x.ex === e.name && x.type !== 'W');
              const active = e.name === name;
              return (
                <span
                  key={e.name}
                  className={`h-1.5 rounded-full transition-all ${
                    done
                      ? 'bg-zinc-950 dark:bg-white'
                      : active
                        ? 'bg-zinc-400 dark:bg-zinc-500'
                        : 'bg-zinc-200 dark:bg-zinc-800'
                  }`}
                />
              );
            })}
          </div>
        )}

        <div className={`mt-3 flex items-center justify-between border-t border-zinc-200 pt-2.5 text-xs dark:border-zinc-800 ${muted}`}>
          <span><b className="font-bold text-zinc-950 dark:text-white">{effectiveTotalSets}</b> {effectiveTotalSets === 1 ? 'serie efectiva' : 'series efectivas'}</span>
          <span>Volumen: <b className="font-bold text-zinc-950 dark:text-white">{fmt(sessionVol)} kg</b></span>
        </div>
      </Card>

      {organizing && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">Organizar ejercicios del entreno</p>
              <p className={`text-xs ${muted}`}>Mueve el orden o añade un ejercicio extra</p>
            </div>
            {orderChanged && (
              <button
                type="button"
                onClick={saveOrderToRoutine}
                className="rounded-full bg-zinc-950 px-3 py-1.5 text-[11px] font-extrabold text-white dark:bg-white dark:text-zinc-950"
              >
                {orderSavedNotice ? '¡Guardado!' : 'Guardar en rutina'}
              </button>
            )}
          </div>

          <ul className="space-y-1.5">
            {sessionExercises.map((e, i) => {
              const count = sets.filter((s) => s.ex === e.name && s.type !== 'W').length;
              const goalSets = Number(e.targetSets) || 0;
              return (
                <li key={`${e.name}-${i}`} className="flex items-center justify-between gap-2 rounded-2xl bg-zinc-200/70 px-3 py-2 dark:bg-zinc-800/70">
                  <button
                    type="button"
                    onClick={() => { setName(e.name); setOrganizing(false); }}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-[11px] font-extrabold text-white dark:bg-white dark:text-zinc-950">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{e.name}</p>
                      <p className={`text-[10px] ${muted}`}>
                        {e.muscle}{goalSets > 0 ? ` · ${count}/${goalSets} ser.` : count > 0 ? ` · ${count} ser.` : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveSessionExercise(i, i - 1)}
                      disabled={i === 0}
                      aria-label={`Subir ${e.name}`}
                      className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-300 disabled:opacity-25 dark:hover:bg-zinc-700"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSessionExercise(i, i + 1)}
                      disabled={i === sessionExercises.length - 1}
                      aria-label={`Bajar ${e.name}`}
                      className="flex size-7 items-center justify-center rounded-full hover:bg-zinc-300 disabled:opacity-25 dark:hover:bg-zinc-700"
                    >
                      <ArrowDown size={14} />
                    </button>
                    {sets.filter((s) => s.ex === e.name).length === 0 && (
                      <button
                        type="button"
                        onClick={() => removeSessionExercise(i)}
                        aria-label={`Quitar ${e.name} de hoy`}
                        className="flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/15 hover:text-rose-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <form onSubmit={addExtraExercise} className="flex gap-1.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <input
              aria-label="Ejercicio extra"
              placeholder="Ejercicio extra..."
              value={extraName}
              onChange={(e) => setExtraName(e.target.value)}
              className={`${field} !h-10 w-full min-w-0 text-xs`}
            />
            <input
              inputMode="numeric"
              aria-label="Series"
              placeholder="Ser."
              value={extraSets}
              onChange={(e) => setExtraSets(e.target.value)}
              className={`${field} !h-10 w-14 shrink-0 px-1 text-center text-xs`}
            />
            <select
              aria-label="Músculo"
              value={extraMuscle}
              onChange={(e) => setExtraMuscle(e.target.value)}
              className={`${field} !h-10 shrink-0 px-2 text-xs`}
            >
              {MUSCLES.map((m) => <option key={m}>{m}</option>)}
            </select>
            <button type="submit" disabled={!extraName.trim()} aria-label="Añadir" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950">
              <Plus size={16} />
            </button>
          </form>
        </Card>
      )}

      {sessionExercises.length === 0 ? (
        <Card className="text-center">
          <p className={`text-sm ${muted}`}>Esta rutina no tiene ejercicios.</p>
          <button type="button" onClick={() => go('inicio')} className="mt-3 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
            Añadir en Inicio
          </button>
        </Card>
      ) : (
        <div className="-mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sessionExercises.map((e, idx) => {
            const n = sets.filter((x) => x.ex === e.name && x.type !== 'W').length;
            const goalSets = Number(e.targetSets) || 0;
            const completedGoal = goalSets > 0 ? n >= goalSets : n > 0;
            const on = e.name === name;
            return (
              <button
                key={e.name}
                type="button"
                onClick={() => setName(e.name)}
                aria-pressed={on}
                className={`flex w-40 shrink-0 snap-center flex-col justify-between rounded-[24px] p-3.5 text-left transition-all ${
                  on
                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                    : 'bg-zinc-100 text-zinc-950 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={`truncate text-[10px] font-bold uppercase tracking-wider ${on ? 'opacity-70' : muted}`}>
                    {String(idx + 1).padStart(2, '0')} · {e.muscle}
                  </span>
                  {completedGoal && (
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-full ${on ? 'bg-white text-zinc-950 dark:bg-zinc-950 dark:text-white' : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'}`}>
                      <Check size={10} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <p className="mt-1.5 truncate text-sm font-extrabold">{e.name}</p>

                <div className="mt-2.5 flex items-center justify-between">
                  <span className={`text-xs font-semibold ${on ? 'opacity-75' : muted}`}>
                    {goalSets > 0 ? `${n}/${goalSets} series` : `${n} ${n === 1 ? 'serie' : 'series'}`}
                  </span>
                  <div className="flex items-end gap-0.5 opacity-50" aria-hidden="true">
                    {[3, 6, 3].map((h, i) => (
                      <span
                        key={i}
                        className={`w-0.5 rounded-full ${on ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                        style={{ height: `${h * 1.5}px` }}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {rest > 0 && (
        <div className="rounded-[26px] bg-zinc-950 p-4 text-white dark:bg-zinc-900 dark:ring-1 dark:ring-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-white/10">
                <Timer size={20} />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Descanso · {mmss(targetRest)}
                </p>
                <p className="text-3xl font-extrabold leading-none tracking-tight">
                  {rest}<span className="ml-0.5 text-base font-bold text-zinc-400">s</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => adjustRest(-15)} aria-label="Restar 15 segundos" className="h-9 rounded-full bg-white/10 px-3 text-xs font-bold hover:bg-white/20">−15s</button>
              <button type="button" onClick={() => adjustRest(15)} aria-label="Sumar 15 segundos" className="h-9 rounded-full bg-white/10 px-3 text-xs font-bold hover:bg-white/20">+15s</button>
              <button type="button" onClick={() => setRest(0)} className="h-9 rounded-full bg-white px-3.5 text-xs font-extrabold text-zinc-950 hover:bg-zinc-200">Saltar</button>
            </div>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, (rest / targetRest) * 100))}%` }}
            />
          </div>
        </div>
      )}

      <Card className="text-center">
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {targetMeta && (
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-200/80 px-3 py-1 text-xs font-semibold dark:bg-zinc-800">
              <Target size={12} className={muted} />
              Objetivo: <b>{targetMeta}</b>
            </span>
          )}
          {last && (
            <button
              type="button"
              onClick={() => setInput({ kg: String(last.kg), reps: String(last.reps) })}
              title="Usar peso y repeticiones de la última vez"
              className="inline-flex items-center gap-1 rounded-full bg-zinc-200/80 px-3 py-1 text-xs font-semibold transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <History size={12} className={muted} />
              Última: <b>{fmt(last.kg, 1)} kg × {last.reps}</b>
            </button>
          )}
          {!editingNote && !currentPersistentNote && name && (
            <button
              type="button"
              onClick={() => setEditingNote(true)}
              className={`inline-flex items-center gap-1 rounded-full bg-zinc-200/60 px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-zinc-300 dark:bg-zinc-800/60 dark:hover:bg-zinc-700 ${muted}`}
            >
              <StickyNote size={12} /> + Nota fija
            </button>
          )}
        </div>

        {name && (editingNote || currentPersistentNote) && (
          <div className="mt-2.5">
            {editingNote ? (
              <form onSubmit={handleSaveExerciseNote} className="flex items-center gap-1.5 text-left">
                <input
                  aria-label="Nota fija del ejercicio"
                  placeholder="Ej. Asiento al 4, agarre neutro..."
                  value={noteDraft}
                  maxLength={120}
                  autoFocus
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className={`${field} !h-9 w-full min-w-0 px-3 text-xs font-medium`}
                />
                <button
                  type="submit"
                  aria-label="Guardar nota"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                >
                  <Check size={15} />
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setEditingNote(true)}
                title="Editar nota fija de este ejercicio"
                className="mx-auto inline-flex max-w-full items-center gap-1.5 rounded-2xl bg-zinc-200/80 px-3 py-1.5 text-left text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-300/80 dark:bg-zinc-800/90 dark:text-zinc-200 dark:hover:bg-zinc-700"
              >
                <StickyNote size={12} className={`shrink-0 ${muted}`} />
                <span className="truncate">{currentPersistentNote}</span>
                <Pencil size={11} className={`shrink-0 opacity-60 ${muted}`} />
              </button>
            )}
          </div>
        )}

        <p className="mt-3 text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Repeticiones hechas
        </p>

        <RepsPicker value={reps} onChange={(n) => setInput((v) => ({ ...v, reps: String(n) }))} />

        <form onSubmit={add} className="mt-5 space-y-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepKg(-2.5)}
              aria-label="Restar 2,5 kg"
              className="flex h-12 shrink-0 items-center gap-0.5 rounded-2xl bg-zinc-200 px-3 text-xs font-extrabold transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Minus size={13} />2.5
            </button>

            <div className="relative min-w-0 flex-1">
              <input
                inputMode="decimal"
                aria-label="Kilos"
                placeholder={last ? `${fmt(last.kg, 1)}` : '0'}
                value={input.kg}
                onChange={(e) => setInput((v) => ({ ...v, kg: e.target.value }))}
                className={`${field} !h-12 w-full pr-9 text-center text-lg font-extrabold`}
              />
              <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold ${muted}`}>kg</span>
            </div>

            <button
              type="button"
              onClick={() => stepKg(2.5)}
              aria-label="Sumar 2,5 kg"
              className="flex h-12 shrink-0 items-center gap-0.5 rounded-2xl bg-zinc-200 px-3 text-xs font-extrabold transition-colors hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Plus size={13} />2.5
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-left">
            <div className="rounded-2xl bg-zinc-200/60 p-2 dark:bg-zinc-800/60">
              <span className={`mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-wider ${muted}`}>
                Tipo · {SET_TYPES.find((t) => t.id === setType)?.label}
              </span>
              <div className="grid grid-cols-4 gap-1">
                {SET_TYPES.map((t) => {
                  const active = setType === t.id;
                  return (
                    <button
                      key={t.short}
                      type="button"
                      onClick={() => setSetType(t.id)}
                      aria-pressed={active}
                      title={t.label}
                      className={`flex h-8 items-center justify-center rounded-xl text-xs font-extrabold transition-colors ${
                        active
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-white/80 text-zinc-700 hover:bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {t.short}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-zinc-200/60 p-2 dark:bg-zinc-800/60">
              <span className={`mb-1.5 block px-1 text-[10px] font-bold uppercase tracking-wider ${muted}`}>
                RIR {rir ? `· ${rir} en recámara` : '· Opcional'}
              </span>
              <div className="grid grid-cols-4 gap-1">
                {RIR_OPTIONS.map((opt) => {
                  const active = rir === opt;
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setRir(active ? '' : opt)}
                      aria-pressed={active}
                      aria-label={`RIR ${opt}`}
                      className={`flex h-8 items-center justify-center rounded-xl text-xs font-extrabold transition-colors ${
                        active
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-white/80 text-zinc-700 hover:bg-white dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button type="submit" disabled={!name} className={`${primary} flex !h-12 items-center justify-center gap-2 !text-sm`}>
            <Plus size={17} strokeWidth={2.5} />
            {setType === 'W'
              ? 'Registrar calentamiento'
              : `Registrar serie ${effectiveMine.length + 1}${Number(currentEx?.targetSets) > 0 ? ` de ${currentEx.targetSets}` : ''}`}
          </button>

          {preview1rm > 0 && setType !== 'W' && (
            <div className="flex items-center justify-center gap-2 pt-0.5 text-xs">
              <span className={`inline-flex items-center gap-1 ${muted}`}>
                <Zap size={12} /> 1RM est.: <b className="font-bold text-zinc-950 dark:text-white">{fmt(preview1rm, 1)} kg</b>
              </span>
              {willBePr && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold text-amber-600 dark:text-amber-400">
                  <Trophy size={11} /> ¡Nuevo récord!
                </span>
              )}
            </div>
          )}
        </form>
      </Card>

      {name && (
        <section>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                Series · {name}
                {Number(currentEx?.targetSets) > 0 && (
                  <span className={`ml-2 text-sm font-semibold ${muted}`}>
                    ({effectiveMine.length}/{currentEx.targetSets})
                  </span>
                )}
              </h2>
              {warmupCount > 0 && (
                <p className={`text-xs ${muted}`}>
                  + {warmupCount} {warmupCount === 1 ? 'serie de calentamiento' : 'series de calentamiento'} (no suma al volumen efectivo)
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={addQuickSet}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-1.5 text-xs font-bold transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
            >
              {mine.length > 0 ? <><Repeat size={13} /> Repetir última</> : <><Plus size={13} /> Añadir serie</>}
            </button>
          </div>

          {mine.length > 0 && (
            <ol className="mt-3 space-y-2">
              {(() => {
                let effectiveCounter = 0;
                return mine.map((x, i) => {
                  const isWarmup = x.type === 'W';
                  if (!isWarmup) effectiveCounter += 1;
                  const displayNum = isWarmup ? 'W' : String(effectiveCounter).padStart(2, '0');
                  const isEditingThisSet = editingSetIdx === x.idx;
                  const tMeta = setTypeMeta(x.type);

                  return (
                    <li key={x.idx} className="rounded-[22px] bg-zinc-100 p-3 pl-3.5 dark:bg-zinc-900">
                      <div className="flex items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => startEditSet(x)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                            isWarmup
                              ? 'border border-dashed border-zinc-400 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
                              : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          }`}>
                            {displayNum}
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="text-sm font-extrabold">
                                {fmt(x.kg, 1)} kg <span className={`font-semibold ${muted}`}>×</span> {x.reps} reps
                              </p>
                              {tMeta && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${tMeta.badge}`}>
                                  {tMeta.short} · {tMeta.name}
                                </span>
                              )}
                              {x.rir && (
                                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-extrabold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                  RIR {x.rir}
                                </span>
                              )}
                              {x.pr && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                                  <Trophy size={10} /> Récord
                                </span>
                              )}
                            </div>
                            <p className={`text-[11px] ${muted}`}>
                              {isWarmup
                                ? 'Serie de calentamiento · excluida de topes semanales'
                                : `Volumen: ${fmt(x.kg * x.reps)} kg · 1RM ${fmt(e1rm(x.kg, x.reps), 1)} kg`}
                            </p>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={() => startEditSet(x)}
                            aria-label={`Editar serie ${i + 1}`}
                            className={`flex size-8 items-center justify-center rounded-full transition-colors ${isEditingThisSet ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-slate-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                          >
                            <Pencil size={13} />
                          </button>
                          <button type="button" onClick={() => commit(sets.filter((_, j) => j !== x.idx))} aria-label={`Quitar serie ${i + 1}`} className={trash}>
                            <X size={15} />
                          </button>
                        </div>
                      </div>

                      {isEditingThisSet && (
                        <div className="mt-2.5 space-y-2 border-t border-zinc-200 pt-2.5 dark:border-zinc-800">
                          <div className="flex items-center gap-2">
                            <div className="relative min-w-0 flex-1">
                              <input
                                inputMode="decimal"
                                aria-label="Editar kilos"
                                value={editSetForm.kg}
                                onChange={(e) => setEditSetForm((v) => ({ ...v, kg: e.target.value }))}
                                className={`${field} !h-9 w-full pr-7 text-center text-xs font-extrabold`}
                              />
                              <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold ${muted}`}>kg</span>
                            </div>
                            <div className="relative min-w-0 flex-1">
                              <input
                                inputMode="numeric"
                                aria-label="Editar repeticiones"
                                value={editSetForm.reps}
                                onChange={(e) => setEditSetForm((v) => ({ ...v, reps: e.target.value }))}
                                className={`${field} !h-9 w-full pr-9 text-center text-xs font-extrabold`}
                              />
                              <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold ${muted}`}>reps</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => saveEditSet(x.idx)}
                              className="flex h-9 shrink-0 items-center gap-1 rounded-xl bg-zinc-950 px-3 text-xs font-extrabold text-white dark:bg-white dark:text-zinc-950"
                            >
                              <Check size={14} /> Guardar
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1">
                              {SET_TYPES.map((t) => (
                                <button
                                  key={t.short}
                                  type="button"
                                  onClick={() => setEditSetForm((v) => ({ ...v, type: t.id }))}
                                  className={`h-7 rounded-lg px-2 text-[11px] font-extrabold ${
                                    editSetForm.type === t.id
                                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                  }`}
                                >
                                  {t.short}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className={`text-[10px] font-bold uppercase ${muted}`}>RIR:</span>
                              {RIR_OPTIONS.map((opt) => (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setEditSetForm((v) => ({ ...v, rir: v.rir === opt ? '' : opt }))}
                                  className={`h-7 rounded-lg px-2 text-[11px] font-extrabold ${
                                    editSetForm.rir === opt
                                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                  }`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                });
              })()}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}

const WEEK_DAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const BODY_MEASURES = [
  ['waist', 'Cintura'],
  ['hip', 'Cadera'],
  ['chest', 'Pecho'],
  ['arm', 'Brazo'],
  ['thigh', 'Muslo'],
];

const emptyBodyMetric = () => ({
  date: iso(),
  weight: '',
  waist: '',
  hip: '',
  chest: '',
  arm: '',
  thigh: '',
});

function BodyMeasurements() {
  const { bodyMetrics = [], saveBodyMetric, deleteBodyMetric } = useGym();
  const [form, setForm] = useState(emptyBodyMetric);
  const [editingDate, setEditingDate] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState('');
  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFormError('');
  };
  const ordered = [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date));
  const weights = ordered.filter((entry) => Number.isFinite(Number(entry.weight)) && Number(entry.weight) > 0);
  const latestWeight = weights.at(-1);
  const previousWeight = weights.length > 1 ? weights.at(-2) : null;
  const weightChange = latestWeight && previousWeight ? Number(latestWeight.weight) - Number(previousWeight.weight) : null;
  const chartWeights = weights.slice(-8);
  const minWeight = Math.min(...chartWeights.map((entry) => Number(entry.weight)));
  const maxWeight = Math.max(...chartWeights.map((entry) => Number(entry.weight)));
  const chartPoints = chartWeights.map((entry, index) => ({
    x: chartWeights.length > 1 ? 12 + index * (276 / (chartWeights.length - 1)) : 150,
    y: 82 - ((Number(entry.weight) - minWeight) / (maxWeight - minWeight || 1)) * 56,
  }));
  const chartLine = chartPoints.map((point) => `${point.x},${point.y}`).join(' ');

  const openNewForm = () => {
    setForm(emptyBodyMetric());
    setEditingDate(null);
    setFormError('');
    setFormOpen(true);
  };

  const editMetric = (metric) => {
    setForm({ ...emptyBodyMetric(), ...metric });
    setEditingDate(metric.date);
    setFormError('');
    setFormOpen(true);
  };

  const submitMetric = (event) => {
    event.preventDefault();
    setFormError('');
    const metric = { date: form.date };
    for (const key of ['weight', ...BODY_MEASURES.map(([name]) => name)]) {
      const raw = String(form[key] ?? '').trim().replace(',', '.');
      if (!raw) continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) {
        setFormError('Introduce valores mayores que cero.');
        return;
      }
      metric[key] = value;
    }
    if (Object.keys(metric).length === 1) {
      setFormError('Añade el peso o al menos una medida.');
      return;
    }
    if (bodyMetrics.some((entry) => entry.date === metric.date && entry.date !== editingDate)) {
      setFormError('Ya existe un registro para esa fecha. Edítalo desde el historial.');
      return;
    }
    saveBodyMetric(metric, editingDate);
    setForm(emptyBodyMetric());
    setEditingDate(null);
    setFormOpen(false);
  };

  const removeMetric = (date) => {
    if (window.confirm('¿Eliminar este registro de peso y medidas?')) {
      deleteBodyMetric(date);
      if (editingDate === date) {
        setEditingDate(null);
        setForm(emptyBodyMetric());
        setFormOpen(false);
        setFormError('');
      }
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Peso y medidas</h2>
          <p className={`mt-0.5 text-xs ${muted}`}>Sigue tu evolución corporal junto a tu fuerza</p>
        </div>
        <button
          type="button"
          onClick={formOpen ? () => setFormOpen(false) : openNewForm}
          aria-label={formOpen ? 'Cerrar formulario' : 'Añadir registro corporal'}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {formOpen ? <X size={16} /> : <Plus size={17} />}
        </button>
      </div>

      {formOpen && (
        <Card className="mt-3">
          <form onSubmit={submitMetric} className="space-y-3">
            <label className="block text-xs font-semibold">
              <span className={`mb-1 block ${muted}`}>Fecha</span>
              <input
                type="date"
                required
                value={form.date}
                onChange={(event) => updateForm('date', event.target.value)}
                className={`${field} w-full`}
              />
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <label className="rounded-2xl bg-zinc-200/70 p-3 text-xs font-semibold dark:bg-zinc-800/70">
                <span className={`flex items-center gap-1 ${muted}`}><Scale size={13} /> Peso (kg)</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.1"
                  step="0.1"
                  max="999.9"
                  placeholder="Opcional"
                  value={form.weight ?? ''}
                  onChange={(event) => updateForm('weight', event.target.value)}
                  className="mt-1 w-full bg-transparent text-base font-extrabold outline-none"
                />
              </label>
              {BODY_MEASURES.map(([key, label]) => (
                <label key={key} className="rounded-2xl bg-zinc-200/70 p-3 text-xs font-semibold dark:bg-zinc-800/70">
                  <span className={`flex items-center gap-1 ${muted}`}><Ruler size={13} /> {label} (cm)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="0.1"
                    max="999.9"
                    placeholder="Opcional"
                    value={form[key] ?? ''}
                    onChange={(event) => updateForm(key, event.target.value)}
                    className="mt-1 w-full bg-transparent text-base font-extrabold outline-none"
                  />
                </label>
              ))}
            </div>
            <p className={`text-xs ${muted}`}>Añade el peso, una medida o ambos. Solo tú puedes ver estos datos.</p>
            {formError && <p role="alert" className="text-sm font-semibold text-rose-600 dark:text-rose-400">{formError}</p>}
            <button type="submit" className={`${primary} !h-11 !text-sm`}>
              {editingDate ? 'Guardar cambios' : 'Guardar registro'}
            </button>
          </form>
        </Card>
      )}

      {ordered.length === 0 ? (
        <Card className="mt-3 text-center">
          <Scale size={22} className={`mx-auto ${muted}`} />
          <p className="mt-2 text-sm font-semibold">Aún no tienes registros corporales</p>
          <p className={`mt-1 text-xs ${muted}`}>Añade tu peso o medidas para empezar a ver tu evolución.</p>
          {!formOpen && (
            <button type="button" onClick={openNewForm} className={`${primary} mt-4 !h-11 !text-sm`}>
              Añadir primer registro
            </button>
          )}
        </Card>
      ) : (
        <>
          {latestWeight && (
            <Card className="mt-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Último peso</p>
                  <p className="mt-1 text-4xl font-extrabold tracking-tight">{fmt(Number(latestWeight.weight), 1)} <span className={`text-base ${muted}`}>kg</span></p>
                  <p className={`mt-1 text-xs ${muted}`}>{shortDate(latestWeight.date)}</p>
                </div>
                {weightChange !== null && (
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${weightChange > 0 ? 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200' : weightChange < 0 ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'}`}>
                    {weightChange > 0 ? '+' : ''}{fmt(weightChange, 1)} kg
                  </span>
                )}
              </div>
              {chartPoints.length > 1 && (
                <>
                  <svg viewBox="0 0 300 96" className="mt-4 w-full text-zinc-950 dark:text-white" role="img" aria-label="Evolución del peso corporal">
                    <line x1="12" y1="82" x2="288" y2="82" stroke="currentColor" strokeOpacity="0.1" />
                    <polyline points={chartLine} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    {chartPoints.map((point, index) => (
                      <circle key={chartWeights[index].date} cx={point.x} cy={point.y} r={index === chartPoints.length - 1 ? 4 : 3} className={index === chartPoints.length - 1 ? 'fill-zinc-950 dark:fill-white' : 'fill-zinc-400 dark:fill-zinc-500'} />
                    ))}
                  </svg>
                  <div className={`flex justify-between text-[11px] ${muted}`}>
                    <span>{shortDate(chartWeights[0].date)}</span>
                    <span>{shortDate(chartWeights.at(-1).date)}</span>
                  </div>
                </>
              )}
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                {BODY_MEASURES.map(([key, label]) => {
                  const entry = [...ordered].reverse().find((item) => Number(item[key]) > 0);
                  return (
                    <div key={key}>
                      <p className={`text-[10px] font-semibold uppercase tracking-wider ${muted}`}>{label}</p>
                      <p className="mt-0.5 text-sm font-extrabold">{entry ? `${fmt(Number(entry[key]), 1)} cm` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          <div className="mt-3 space-y-2">
            {[...ordered].reverse().slice(0, 6).map((entry) => (
              <div key={entry.date} className="flex items-center gap-3 rounded-[22px] bg-zinc-100 px-4 py-3 dark:bg-zinc-900">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{shortDate(entry.date)}</p>
                  <p className={`mt-0.5 truncate text-xs ${muted}`}>
                    {entry.weight ? `${fmt(Number(entry.weight), 1)} kg` : ''}
                    {entry.weight && BODY_MEASURES.some(([key]) => entry[key]) ? ' · ' : ''}
                    {BODY_MEASURES.filter(([key]) => entry[key]).map(([key, label]) => `${label.toLowerCase()} ${fmt(Number(entry[key]), 1)} cm`).join(' · ') || (!entry.weight ? 'Medidas corporales' : '')}
                  </p>
                </div>
                <button type="button" onClick={() => editMetric(entry)} aria-label={`Editar registro del ${shortDate(entry.date)}`} className={trash}><Pencil size={15} /></button>
                <button type="button" onClick={() => removeMetric(entry.date)} aria-label={`Eliminar registro del ${shortDate(entry.date)}`} className={trash}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export function Progress() {
  const { sessions, routines, goals, saveGoals, updateSession, deleteSession } = useGym();
  const [ex, setEx] = useState('');
  const [editing, setEditing] = useState(false);

  const [editingSessionId, setEditingSessionId] = useState(null);
  const [newSetForm, setNewSetForm] = useState({ ex: '', kg: '', reps: '', type: '', rir: '' });

  const names = [...new Set(sessions.flatMap((s) => s.sets.filter((x) => x.type !== 'W').map((x) => x.ex)))];
  const sel = names.includes(ex) ? ex : names[0];
  const ordered = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

  const pts = ordered
    .map((s) => ({
      date: s.date,
      v: Math.max(0, ...s.sets.filter((x) => x.ex === sel && x.type !== 'W').map((x) => e1rm(x.kg, x.reps))),
      maxKg: Math.max(0, ...s.sets.filter((x) => x.ex === sel && x.type !== 'W').map((x) => x.kg)),
    }))
    .filter((p) => p.v > 0);

  const hi = pts.length ? Math.max(...pts.map((p) => p.v)) : 0;
  const lo = pts.length ? Math.min(...pts.map((p) => p.v)) : 0;
  const bestKg = pts.length ? Math.max(...pts.map((p) => p.maxKg)) : 0;
  const coords = pts.map((p, i) => ({
    x: pts.length > 1 ? 12 + i * (286 / (pts.length - 1)) : 155,
    y: pts.length > 1 ? 104 - ((p.v - lo) / (hi - lo || 1)) * 82 : 60,
  }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = coords.length > 1 ? `12,116 ${line} ${coords.at(-1).x},116` : '';
  const gain = pts.length > 1 ? ((pts.at(-1).v - pts[0].v) / pts[0].v) * 100 : 0;

  const counts = weekSets(sessions);
  const weekly = goals.weekly || {};
  const setCap = (m, v) => {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    const next = { ...weekly };
    if (n) next[m] = n; else delete next[m];
    saveGoals({ weekly: next });
  };

  const recent = [...ordered].reverse().slice(0, 8);
  const capTotal = Object.values(weekly).reduce((t, n) => t + n, 0);
  const weekPct = capTotal ? (Object.entries(weekly).reduce((t, [m, c]) => t + Math.min(counts[m] || 0, c), 0) / capTotal) * 100 : 0;
  const records = sessions.flatMap((x) => x.sets).filter((y) => y.pr).length;
  const week = weekVol(sessions, 0), prev = weekVol(sessions, 1);
  const delta = prev ? ((week - prev) / prev) * 100 : null;
  const doneSets = Object.values(counts).reduce((t, n) => t + n, 0);

  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const mondayIso = iso(monday);
  const trainedDates = new Set(sessions.map((s) => s.date));
  const weekStrip = WEEK_DAYS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const k = iso(d);
    return { label, done: trainedDates.has(k), isToday: k === iso() };
  });

  const weekSessionsCount = sessions.filter((s) => s.date >= mondayIso).length;
  const avgIntensity = doneSets > 0 ? week / doneSets : 0;
  const totalTons = sessions.reduce((t, s) => t + s.sets.reduce((u, x) => u + x.kg * x.reps, 0), 0) / 1000;
  const topMuscleEntry = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];

  const rulerMetrics = [
    { label: 'Intensidad', value: fmt(avgIntensity, 0), unit: 'kg / serie', active: avgIntensity > 0 },
    { label: 'Sesiones', value: weekSessionsCount, unit: 'esta semana', active: weekSessionsCount > 0 },
    { label: 'Racha', value: calcStreak(sessions), unit: 'días seguidos', active: calcStreak(sessions) > 0 },
    { label: 'Récords', value: records, unit: 'PR totales', active: records > 0 },
    { label: 'Músculo top', value: topMuscleEntry ? topMuscleEntry[1] : 0, unit: topMuscleEntry ? topMuscleEntry[0] : 'sin datos', active: !!topMuscleEntry },
    { label: 'Acumulado', value: fmt(totalTons, 1), unit: 'toneladas', active: totalTons > 0 },
  ];

  const lastOf = (n) => {
    const x = [...ordered].reverse().find((z) => z.sets.some((y) => y.ex === n && y.type !== 'W'));
    return x ? Math.max(...x.sets.filter((y) => y.ex === n && y.type !== 'W').map((y) => e1rm(y.kg, y.reps))) : 0;
  };

  const hasCaps = Object.keys(weekly).length > 0;
  const muscleEntries = hasCaps
    ? Object.entries(weekly)
    : Object.entries(counts).sort((a, b) => b[1] - a[1]);

  const toggleEditSession = (session) => {
    if (editingSessionId === session.id) {
      setEditingSessionId(null);
      return;
    }
    const defaultEx = session.sets[0]?.ex || routines[session.name]?.[0]?.name || '';
    const lastSet = [...session.sets].reverse().find((s) => s.ex === defaultEx);
    setEditingSessionId(session.id);
    setNewSetForm({
      ex: defaultEx,
      kg: lastSet ? String(lastSet.kg) : '',
      reps: lastSet ? String(lastSet.reps) : '',
      type: '',
      rir: '',
    });
  };

  const handleAddSetToHistory = (e, session) => {
    e.preventDefault();
    const cleanEx = newSetForm.ex.trim();
    const kg = Number(String(newSetForm.kg).replace(',', '.'));
    const reps = Math.floor(Number(newSetForm.reps));
    if (!cleanEx || !(kg >= 0) || !(reps > 0) || !updateSession) return;
    const routineEx = Object.values(routines).flat().find((item) => item.name.toLowerCase() === cleanEx.toLowerCase());
    updateSession(session.id, (s) => ({
      sets: [
        ...s.sets,
        {
          ex: cleanEx,
          muscle: routineEx?.muscle,
          kg,
          reps,
          ...(newSetForm.type && { type: newSetForm.type }),
          ...(newSetForm.rir && { rir: newSetForm.rir }),
        },
      ],
    }));
    setNewSetForm((v) => ({ ...v, kg: String(kg), reps: String(reps) }));
  };

  const handleRemoveSetFromHistory = (session, setIndex) => {
    if (!updateSession) return;
    if (session.sets.length <= 1) {
      if (window.confirm('Es la última serie del entreno. ¿Eliminar el entreno completo?')) {
        deleteSession(session.id);
        setEditingSessionId(null);
      }
      return;
    }
    updateSession(session.id, (s) => ({
      sets: s.sets.filter((_, idx) => idx !== setIndex),
    }));
  };

  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Volumen semanal</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold tracking-tight">{fmt(week)}</span>
              <span className={`text-sm font-bold ${muted}`}>kg</span>
            </div>
          </div>
          {delta !== null && (
            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${delta < 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'}`}>
              <TrendingUp size={13} className={delta < 0 ? 'rotate-180' : ''} />
              {delta < 0 ? '−' : '+'}{fmt(Math.abs(delta), 0)}%
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {weekStrip.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div className={`flex h-9 w-full items-center justify-center rounded-xl text-xs font-extrabold transition-all ${
                d.done
                  ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                  : d.isToday
                    ? 'border border-dashed border-zinc-400 text-zinc-950 dark:border-zinc-500 dark:text-white'
                    : 'bg-zinc-200/80 text-zinc-400 dark:bg-zinc-800/80 dark:text-zinc-500'
              }`}>
                {d.done ? <Check size={14} strokeWidth={3} /> : d.label}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className={`font-medium ${muted}`}>
              {capTotal ? `Objetivo semanal · ${Math.round(weekPct)}%` : 'Series efectivas esta semana'}
            </span>
            <b className="font-bold">{doneSets}{capTotal ? ` / ${capTotal} series` : ' series'}</b>
          </div>
          <Bar value={capTotal ? weekPct : Math.min(100, doneSets * 4)} />
        </div>
      </Card>

      <BodyMeasurements />

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Métricas clave</h2>
          <span className={`text-xs ${muted}`}>Desliza →</span>
        </div>
        <div className="-mx-5 mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rulerMetrics.map((m) => (
            <div key={m.label} className="flex w-36 shrink-0 snap-center flex-col justify-between rounded-[26px] bg-zinc-100 p-4 dark:bg-zinc-900">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${muted}`}>{m.label}</span>
              <div className="my-3">
                <p className="text-4xl font-extrabold leading-none tracking-tight">{m.value}</p>
                <p className={`mt-1 truncate text-xs font-medium ${muted}`}>{m.unit}</p>
              </div>
              <div className="flex items-end justify-between pt-1 opacity-40" aria-hidden="true">
                {[4, 7, 4, 10, 4, 7, 4].map((h, idx) => (
                  <span
                    key={idx}
                    className={`w-0.5 rounded-full ${m.active && idx === 3 ? 'bg-zinc-950 opacity-100 dark:bg-white' : 'bg-zinc-400 dark:bg-zinc-600'}`}
                    style={{ height: `${h * 1.6}px` }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Fuerza · 1RM</h2>
          {pts.length > 0 && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${muted}`}>
              <Zap size={13} /> Máx. {fmt(bestKg, 1)} kg
            </span>
          )}
        </div>

        {names.length === 0 ? (
          <p className={`mt-3 text-sm ${muted}`}>Aún no hay entrenos. Termina uno para ver tu evolución.</p>
        ) : (
          <>
            <div className="-mx-5 mt-3 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {names.map((n) => {
                const on = n === sel;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setEx(n)}
                    aria-pressed={on}
                    className={`shrink-0 snap-center rounded-3xl p-4 text-left transition-all ${
                      on
                        ? 'w-44 bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                        : 'w-32 bg-zinc-200/80 dark:bg-zinc-900'
                    }`}
                  >
                    <p className="truncate text-xs font-semibold opacity-80">{n}</p>
                    <p className={`mt-2.5 font-extrabold leading-none tracking-tight ${on ? 'text-4xl' : 'text-3xl'}`}>
                      {fmt(lastOf(n))}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] opacity-60">kg · 1RM</span>
                      <span className={`h-1.5 w-5 rounded-full ${on ? 'bg-white dark:bg-zinc-950' : 'bg-zinc-400/40'}`} />
                    </div>
                  </button>
                );
              })}
            </div>

            {pts.length > 0 && (
              <Card className="mt-3">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className={`text-xs font-medium ${muted}`}>Progreso en {sel}</p>
                    <p className={`mt-0.5 text-lg font-extrabold ${gain < 0 ? bad : ''}`}>
                      {gain < 0 ? '−' : '+'}{fmt(Math.abs(gain), 1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs ${muted}`}>Récord 1RM</p>
                    <p className="text-sm font-extrabold">{fmt(hi, 1)} kg</p>
                  </div>
                </div>

                <svg viewBox="0 0 310 124" className="mt-3 w-full text-zinc-950 dark:text-white" role="img" aria-label={`Evolución del 1RM estimado de ${sel}`}>
                  <defs>
                    <linearGradient id="rmGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="12" y1="22" x2="298" y2="22" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
                  <line x1="12" y1="104" x2="298" y2="104" stroke="currentColor" strokeOpacity="0.08" strokeDasharray="4 4" />
                  {area && <polygon points={area} fill="url(#rmGrad)" />}
                  {coords.length > 1 && (
                    <polyline points={line} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                  {coords.map((c, idx) => (
                    <circle
                      key={idx}
                      cx={c.x}
                      cy={c.y}
                      r={idx === coords.length - 1 ? 5 : 3}
                      className={idx === coords.length - 1 ? 'fill-zinc-950 dark:fill-white' : 'fill-zinc-400 dark:fill-zinc-500'}
                    />
                  ))}
                </svg>

                <div className={`mt-1 flex justify-between text-xs ${muted}`}>
                  <span>{shortDate(pts[0].date)}</span>
                  <span>{pts.length} {pts.length === 1 ? 'sesión' : 'sesiones'}</span>
                  <span>{shortDate(pts.at(-1).date)}</span>
                </div>
              </Card>
            )}
          </>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Volumen por músculo</h2>
            <p className={`text-xs ${muted}`}>{hasCaps ? 'Series efectivas vs. tope (sin calentamiento)' : 'Series efectivas esta semana (sin calentamiento)'}</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-label="Editar topes"
            aria-pressed={editing}
            className={`flex size-9 items-center justify-center rounded-full transition-colors ${editing ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800'}`}
          >
            {editing ? <X size={16} /> : <Pencil size={16} />}
          </button>
        </div>

        {editing ? (
          <Card className="mt-3">
            <p className={`mb-3 text-xs font-medium ${muted}`}>Fija tu tope de series efectivas por semana (0 = sin tope)</p>
            <div className="grid grid-cols-2 gap-2.5">
              {MUSCLES.map((m) => (
                <label key={m} className="rounded-2xl bg-zinc-200/70 p-3 text-xs font-semibold dark:bg-zinc-800/70">
                  <span className={`block ${muted}`}>{m}</span>
                  <input
                    inputMode="numeric"
                    placeholder="Sin tope"
                    value={weekly[m] ?? ''}
                    onChange={(e) => setCap(m, e.target.value)}
                    className="mt-1 w-full bg-transparent text-lg font-extrabold text-zinc-950 outline-none dark:text-white"
                  />
                </label>
              ))}
            </div>
          </Card>
        ) : muscleEntries.length === 0 ? (
          <Card className="mt-3 text-center">
            <Dumbbell size={20} className={`mx-auto ${muted}`} />
            <p className={`mt-2 text-sm ${muted}`}>Sin series efectivas registradas esta semana. Pulsa el lápiz para fijar tus topes.</p>
          </Card>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {muscleEntries.map(([m, val]) => {
              const n = counts[m] || 0;
              const cap = hasCaps ? val : Math.max(12, ...Object.values(counts));
              const ratio = Math.min(1, n / cap);
              const over = hasCaps && n > cap;
              const complete = hasCaps && n >= cap;
              const segs = 8;
              const filled = Math.round(ratio * segs);

              return (
                <div key={m} className="flex flex-col justify-between rounded-[24px] bg-zinc-100 p-4 dark:bg-zinc-900">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{m}</span>
                    {over ? (
                      <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-extrabold text-rose-600 dark:text-rose-400">+{n - cap}</span>
                    ) : complete ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"><Check size={10} strokeWidth={3} /></span>
                    ) : null}
                  </div>

                  <div className="my-2.5 flex items-baseline gap-1">
                    <span className={`text-3xl font-extrabold leading-none tracking-tight ${over ? bad : ''}`}>{n}</span>
                    <span className={`text-xs font-semibold ${muted}`}>
                      {hasCaps ? `/ ${cap} ser.` : n === 1 ? 'serie' : 'series'}
                    </span>
                  </div>

                  <div className="grid grid-cols-8 gap-1 pt-1" aria-hidden="true">
                    {Array.from({ length: segs }, (_, idx) => (
                      <span
                        key={idx}
                        className={`h-1.5 rounded-full transition-all ${
                          idx < filled
                            ? over
                              ? 'bg-rose-500'
                              : 'bg-zinc-950 dark:bg-white'
                            : 'bg-zinc-300/80 dark:bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight">Historial reciente</h2>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold dark:bg-zinc-900">
              {sessions.length} {sessions.length === 1 ? 'entreno' : 'entrenos'}
            </span>
          </div>

          <div className="mt-3 space-y-2.5">
            {recent.map((x) => {
              const vol = x.sets.reduce((t, y) => t + y.kg * y.reps, 0);
              const prs = x.sets.filter((y) => y.pr).length;
              const exCount = new Set(x.sets.map((y) => y.ex)).size;
              const { day, month } = dayParts(x.date);
              const isEditingThis = editingSessionId === x.id;
              const sessionExerciseOptions = [...new Set([
                ...x.sets.map((s) => s.ex),
                ...(routines[x.name] || []).map((e) => e.name),
              ])];

              return (
                <div key={x.id} className="rounded-[24px] bg-zinc-100 p-3.5 dark:bg-zinc-900">
                  <div className="flex items-center gap-3.5">
                    <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                      <span className="text-base font-extrabold leading-none">{day}</span>
                      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-wider opacity-75">{month}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold">{x.name}</p>
                        {prs > 0 && (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-extrabold text-amber-600 dark:text-amber-400">
                            <Flame size={10} />{prs} PR
                          </span>
                        )}
                      </div>
                      <div className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${muted}`}>
                        <span>{exCount} {exCount === 1 ? 'ej.' : 'ejs.'}</span>
                        <span>·</span>
                        <span>{x.sets.length} series</span>
                        <span>·</span>
                        <b className="font-semibold text-zinc-700 dark:text-zinc-300">{fmt(vol)} kg</b>
                        {x.duration > 0 && (
                          <>
                            <span>·</span>
                            <span>{formatMins(x.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleEditSession(x)}
                        aria-label={`Editar series de ${x.name}`}
                        aria-expanded={isEditingThis}
                        className={`flex size-8 items-center justify-center rounded-full transition-colors ${isEditingThis ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'text-slate-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
                      >
                        {isEditingThis ? <X size={15} /> : <Pencil size={15} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (window.confirm('¿Eliminar este entreno?')) deleteSession(x.id); }}
                        aria-label={`Eliminar entreno del ${shortDate(x.date)}`}
                        className={trash}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {isEditingThis && (
                    <div className="mt-3 space-y-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                      <ul className="space-y-1.5">
                        {x.sets.map((s, sIdx) => {
                          const tMeta = setTypeMeta(s.type);
                          return (
                            <li key={sIdx} className="flex items-center justify-between gap-2 rounded-xl bg-zinc-200/70 px-3 py-1.5 text-xs dark:bg-zinc-800/70">
                              <span className="flex min-w-0 items-center gap-1.5">
                                {tMeta && (
                                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-extrabold ${tMeta.badge}`}>
                                    {tMeta.short}
                                  </span>
                                )}
                                <span className="truncate font-semibold">{s.ex}</span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                {s.rir && (
                                  <span className={`text-[10px] font-bold ${muted}`}>RIR {s.rir}</span>
                                )}
                                <span className="font-bold">{fmt(s.kg, 1)} kg × {s.reps}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSetFromHistory(x, sIdx)}
                                  aria-label="Eliminar serie"
                                  className="flex size-6 items-center justify-center rounded-full text-slate-400 hover:bg-rose-500/15 hover:text-rose-600"
                                >
                                  <X size={13} />
                                </button>
                              </span>
                            </li>
                          );
                        })}
                      </ul>

                      <form onSubmit={(e) => handleAddSetToHistory(e, x)} className="space-y-2">
                        <div className="flex gap-1.5">
                          <input
                            list={`ex-opts-${x.id}`}
                            aria-label="Ejercicio"
                            placeholder="Ejercicio"
                            value={newSetForm.ex}
                            onChange={(e) => setNewSetForm((v) => ({ ...v, ex: e.target.value }))}
                            className={`${field} !h-9 w-full min-w-0 px-2.5 text-xs font-semibold`}
                          />
                          <datalist id={`ex-opts-${x.id}`}>
                            {sessionExerciseOptions.map((opt) => <option key={opt} value={opt} />)}
                          </datalist>
                          <input
                            inputMode="decimal"
                            aria-label="Kilos"
                            placeholder="Kg"
                            value={newSetForm.kg}
                            onChange={(e) => setNewSetForm((v) => ({ ...v, kg: e.target.value }))}
                            className={`${field} !h-9 w-16 shrink-0 px-1.5 text-center text-xs font-bold`}
                          />
                          <input
                            inputMode="numeric"
                            aria-label="Repeticiones"
                            placeholder="Reps"
                            value={newSetForm.reps}
                            onChange={(e) => setNewSetForm((v) => ({ ...v, reps: e.target.value }))}
                            className={`${field} !h-9 w-16 shrink-0 px-1.5 text-center text-xs font-bold`}
                          />
                          <button
                            type="submit"
                            aria-label="Añadir serie"
                            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                          >
                            <Plus size={15} />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            {SET_TYPES.map((t) => (
                              <button
                                key={t.short}
                                type="button"
                                onClick={() => setNewSetForm((v) => ({ ...v, type: t.id }))}
                                className={`h-7 rounded-lg px-2 text-[11px] font-extrabold ${
                                  newSetForm.type === t.id
                                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}
                              >
                                {t.short}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`text-[10px] font-bold uppercase ${muted}`}>RIR:</span>
                            {RIR_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => setNewSetForm((v) => ({ ...v, rir: v.rir === opt ? '' : opt }))}
                                className={`h-7 rounded-lg px-2 text-[11px] font-extrabold ${
                                  newSetForm.rir === opt
                                    ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                                    : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ---- Escáner de código de barras conectado a Open Food Facts ----
function BarcodeScanner({ onClose, onSelect }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraSupported] = useState(() => typeof window !== 'undefined' && 'BarcodeDetector' in window && !!navigator.mediaDevices?.getUserMedia);
  const [product, setProduct] = useState(null);
  const [grams, setGrams] = useState('100');

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const fetchOpenFoodFacts = async (rawCode) => {
    const clean = String(rawCode).replace(/\D/g, '');
    if (clean.length < 6) {
      setError('Introduce un código de barras válido (al menos 6 dígitos).');
      return;
    }
    stopCamera();
    setBarcode(clean);
    setError('');
    setLoading(true);
    setProduct(null);

    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name,product_name_es,brands,nutriments,serving_quantity`);
      if (!res.ok) throw new Error('Error al conectar con Open Food Facts.');
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        setError('Producto no encontrado en Open Food Facts. Prueba a escribir los datos manualmente.');
        setLoading(false);
        return;
      }

      const p = json.product;
      const nut = p.nutriments || {};
      const baseName = (p.product_name_es || p.product_name || 'Producto escaneado').trim();
      const brand = p.brands ? p.brands.split(',')[0].trim() : '';
      const displayName = brand && !baseName.toLowerCase().includes(brand.toLowerCase())
        ? `${baseName} (${brand})`
        : baseName;

      const kcal100 = Number(nut['energy-kcal_100g'] ?? (nut.energy_100g ? nut.energy_100g / 4.184 : 0)) || 0;
      const p100 = Number(nut.proteins_100g) || 0;
      const c100 = Number(nut.carbohydrates_100g) || 0;
      const g100 = Number(nut.fat_100g) || 0;
      const servingQty = Number(p.serving_quantity) || null;

      setProduct({
        code: clean,
        name: displayName,
        kcal100,
        p100,
        c100,
        g100,
        servingQty,
      });
      setGrams(servingQty && servingQty > 0 && servingQty <= 500 ? String(Math.round(servingQty)) : '100');
    } catch {
      setError('No se pudo consultar Open Food Facts. Comprueba tu conexión a internet.');
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setError('');
    setProduct(null);
    if (!cameraSupported) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraActive(false);
      setError('No se pudo abrir la cámara. Puedes escribir el número del código de barras abajo.');
    }
  };

  useEffect(() => {
    if (cameraSupported) startCamera();
    return () => stopCamera();
  }, []);

  // Bucle de lectura con BarcodeDetector mientras la cámara está activa
  useEffect(() => {
    if (!cameraActive || !cameraSupported) return undefined;
    let detector;
    try {
      detector = new window.BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'],
      });
    } catch {
      return undefined;
    }

    let cancelled = false;
    const interval = setInterval(async () => {
      if (cancelled || !videoRef.current || videoRef.current.readyState < 2) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && codes[0].rawValue) {
          cancelled = true;
          navigator.vibrate?.(100);
          fetchOpenFoodFacts(codes[0].rawValue);
        }
      } catch { /* ignorar fotograma fallido */ }
    }, 350);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [cameraActive, cameraSupported]);

  const gNum = Math.max(0, Number(String(grams).replace(',', '.')) || 0);
  const factor = gNum / 100;
  const scaled = product ? {
    kcal: Math.round(product.kcal100 * factor),
    p: Math.round(product.p100 * factor * 10) / 10,
    c: Math.round(product.c100 * factor * 10) / 10,
    g: Math.round(product.g100 * factor * 10) / 10,
  } : null;

  const confirmProduct = () => {
    if (!product || !scaled) return;
    const label = gNum > 0 && gNum !== 100 ? `${product.name} (${gNum}g)` : product.name;
    onSelect({
      name: label,
      kcal: String(scaled.kcal),
      p: String(scaled.p),
      c: String(scaled.c),
      g: String(scaled.g),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => { if (e.target === e.currentTarget) { stopCamera(); onClose(); } }}
    >
      <section role="dialog" aria-modal="true" aria-labelledby="scanner-title" className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <ScanBarcode size={16} />
            </span>
            <div>
              <h2 id="scanner-title" className="text-base font-bold leading-none">Escanear producto</h2>
              <p className={`mt-1 text-[11px] ${muted}`}>Base de datos Open Food Facts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { stopCamera(); onClose(); }}
            aria-label="Cerrar escáner"
            className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-zinc-200 dark:text-slate-300 dark:hover:bg-zinc-800"
          >
            <X size={17} />
          </button>
        </div>

        {/* Visor de cámara */}
        {!product && (
          <div className="mt-4 space-y-3">
            {cameraActive ? (
              <div className="relative overflow-hidden rounded-2xl bg-black aspect-[16/10]">
                <video ref={videoRef} playsInline muted autoPlay className="size-full object-cover" />
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-6">
                  <div className="h-24 w-full max-w-[240px] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    <div className="mt-11 h-0.5 w-full bg-rose-500/90" />
                  </div>
                  <span className="mt-3 rounded-full bg-black/70 px-3 py-1 text-[11px] font-semibold text-white">
                    Apunta al código de barras
                  </span>
                </div>
              </div>
            ) : !cameraSupported ? (
              <div className="rounded-2xl bg-zinc-100 p-3.5 text-xs dark:bg-zinc-800/70">
                <p className="font-semibold">Escaneo automático por cámara no disponible en este navegador.</p>
                <p className={`mt-1 ${muted}`}>Escribe los números del código de barras del envase para buscar sus calorías y macros al instante.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={startCamera}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-200 text-xs font-bold dark:bg-zinc-800"
              >
                <Camera size={15} /> Activar cámara
              </button>
            )}

            {/* Búsqueda manual por código numérico */}
            <form
              onSubmit={(e) => { e.preventDefault(); fetchOpenFoodFacts(barcode); }}
              className="flex gap-2"
            >
              <input
                inputMode="numeric"
                aria-label="Código de barras"
                placeholder="Código de barras (ej. 8410076472540)"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className={`${field} w-full min-w-0 font-mono`}
              />
              <button
                type="submit"
                disabled={loading || !barcode.trim()}
                className="h-11 shrink-0 rounded-2xl bg-zinc-950 px-4 text-xs font-extrabold text-white disabled:opacity-40 dark:bg-white dark:text-zinc-950"
              >
                {loading ? 'Buscando...' : 'Buscar'}
              </button>
            </form>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {error}
          </p>
        )}

        {/* Resultado del producto y ajuste de gramos */}
        {product && scaled && (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-zinc-100 p-3.5 dark:bg-zinc-800/70">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold leading-snug">{product.name}</p>
                  <p className={`mt-0.5 font-mono text-[11px] ${muted}`}>
                    #{product.code} · Por 100g: {Math.round(product.kcal100)} kcal · {fmt(product.p100, 1)}P · {fmt(product.c100, 1)}C · {fmt(product.g100, 1)}G
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => { setProduct(null); if (cameraSupported) startCamera(); }}
                  className="shrink-0 rounded-full bg-zinc-200 px-2.5 py-1 text-[11px] font-bold dark:bg-zinc-700"
                >
                  Otro
                </button>
              </div>

              {/* Ajuste de cantidad en gramos */}
              <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="scan-grams" className="text-xs font-bold">Cantidad consumida</label>
                  <div className="relative w-28">
                    <input
                      id="scan-grams"
                      inputMode="decimal"
                      value={grams}
                      onChange={(e) => setGrams(e.target.value)}
                      className={`${field} !h-9 w-full bg-white pr-7 text-center text-sm font-extrabold dark:bg-zinc-900`}
                    />
                    <span className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold ${muted}`}>g</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[50, 100, 150, 200].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setGrams(String(q))}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        gNum === q
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      {q}g
                    </button>
                  ))}
                  {product.servingQty && product.servingQty > 0 && (
                    <button
                      type="button"
                      onClick={() => setGrams(String(Math.round(product.servingQty)))}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                        gNum === Math.round(product.servingQty)
                          ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                          : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                      }`}
                    >
                      1 ración ({Math.round(product.servingQty)}g)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen de macros escalados */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-2xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
                <p className={`text-[10px] font-bold uppercase ${muted}`}>Calorías</p>
                <p className="mt-1 text-base font-extrabold">{scaled.kcal}</p>
              </div>
              <div className="rounded-2xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
                <p className={`text-[10px] font-bold uppercase ${muted}`}>Prot.</p>
                <p className="mt-1 text-base font-extrabold">{scaled.p}g</p>
              </div>
              <div className="rounded-2xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
                <p className={`text-[10px] font-bold uppercase ${muted}`}>Carbos</p>
                <p className="mt-1 text-base font-extrabold">{scaled.c}g</p>
              </div>
              <div className="rounded-2xl bg-zinc-100 p-2.5 dark:bg-zinc-800/70">
                <p className={`text-[10px] font-bold uppercase ${muted}`}>Grasas</p>
                <p className="mt-1 text-base font-extrabold">{scaled.g}g</p>
              </div>
            </div>

            <button type="button" onClick={confirmProduct} className={`${primary} !h-12 !text-sm`}>
              Rellenar datos de comida
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

const MEAL_TYPES = [
  ['Desayuno', Coffee],
  ['Comida', Sun],
  ['Merienda', Cookie],
  ['Cena', Moon],
];
const mealIcon = (type) => MEAL_TYPES.find(([t]) => t === type)?.[1] || Utensils;

const macros = [
  ['Proteína', 'p', Beef, 'bg-zinc-950 dark:bg-white'],
  ['Carbos', 'c', Wheat, 'bg-zinc-600 dark:bg-zinc-300'],
  ['Grasas', 'g', Droplets, 'bg-zinc-400 dark:bg-zinc-500'],
];
const blank = { type: 'Desayuno', name: '', kcal: '', p: '', c: '', g: '' };
const blankRecipe = { ...blank, desc: '' };

export function Diet({ activeDate, go }) {
  const { meals, goals, recipes = [], addMeal, deleteMeal, saveGoals, saveRecipes, cravings = {}, saveCraving, bodyMetrics = [] } = useGym();
  const [f, setF] = useState(blank);
  const [editing, setEditing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const myGoals = goals;
  const [g, setG] = useState(myGoals);

  useEffect(() => setG(myGoals), [goals]);

  const [editingRecipes, setEditingRecipes] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ id: '', ...blankRecipe });

  const currentDate = activeDate || iso();
  const [craving, setCraving] = useState('');
  useEffect(() => setCraving(cravings[currentDate] || ''), [currentDate, cravings]);
  const submitCraving = (event) => {
    event.preventDefault();
    if (saveCraving) saveCraving(currentDate, craving);
  };

  const list = meals.filter((m) => m.date === currentDate);
  const prevDay = new Date(`${currentDate}T00:00`);
  prevDay.setDate(prevDay.getDate() - 1);
  const yesterday = meals.filter((m) => m.date === iso(prevDay));
  const copyYesterday = () => yesterday.forEach(({ type, name, kcal, p, c, g }) => addMeal({ date: currentDate, type, name, kcal, p, c, g }));
  const tot = list.reduce((t, m) => ({ kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, g: t.g + m.g }), { kcal: 0, p: 0, c: 0, g: 0 });
  const set = (k) => (e) => setF((v) => ({ ...v, [k]: e.target.value }));
  const setR = (k) => (e) => setRecipeForm((v) => ({ ...v, [k]: e.target.value }));

  const submitGoals = (event) => {
    event.preventDefault();
    const next = Object.fromEntries(['kcal', 'p', 'c', 'g'].map((k) => [k, Number(g[k])]));
    if (Object.values(next).some((v) => !(v > 0))) return;
    saveGoals(next);
    setEditing(false);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!f.name.trim() || !(Number(f.kcal) >= 0) || f.kcal === '') return;
    addMeal({ date: currentDate, type: f.type, name: f.name.trim(), kcal: Number(f.kcal), p: Number(f.p) || 0, c: Number(f.c) || 0, g: Number(f.g) || 0 });
    setF({ ...blank, type: f.type });
  };

  const loadRecipe = (r) => setF({ ...blank, type: r.type, name: r.name, kcal: r.kcal, p: r.p, c: r.c, g: r.g });

  const handleScannedProduct = (scannedData) => {
    setF((prev) => ({ ...prev, ...scannedData }));
    setScanning(false);
  };

  const submitRecipe = (e) => {
    e.preventDefault();
    if (!recipeForm.name.trim() || !(Number(recipeForm.kcal) >= 0) || recipeForm.kcal === '') return;
    const newR = {
      id: recipeForm.id || crypto.randomUUID(),
      type: recipeForm.type,
      name: recipeForm.name.trim(),
      desc: recipeForm.desc?.trim() || '',
      kcal: Number(recipeForm.kcal),
      p: Number(recipeForm.p) || 0,
      c: Number(recipeForm.c) || 0,
      g: Number(recipeForm.g) || 0,
    };
    if (recipeForm.id) saveRecipes(recipes.map((r) => (r.id === recipeForm.id ? newR : r)));
    else saveRecipes([...recipes, newR]);
    setRecipeForm({ id: '', ...blankRecipe, type: recipeForm.type });
  };

  const deleteRecipe = (id) => saveRecipes(recipes.filter((r) => r.id !== id));
  const editRecipe = (r) => setRecipeForm({ ...r, desc: r.desc || '' });

  const remainingKcal = myGoals.kcal - tot.kcal;
  const overKcal = remainingKcal < 0;
  const latestBodyMetric = [...bodyMetrics].sort((a, b) => a.date.localeCompare(b.date)).at(-1);

  return (
    <div className="space-y-4">

      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
              <Flame size={16} />
            </span>
            <div>
              <p className="text-sm font-bold leading-none">Balance diario</p>
              <p className={`mt-1 text-xs ${muted}`}>Objetivo {fmt(myGoals.kcal)} kcal</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${overKcal ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'}`}>
              {overKcal ? `+${fmt(Math.abs(remainingKcal))} kcal` : `Quedan ${fmt(remainingKcal)}`}
            </span>
            <button
              type="button"
              onClick={() => { setG(myGoals); setEditing((v) => !v); }}
              aria-label="Editar objetivo"
              aria-pressed={editing}
              className={`flex size-8 items-center justify-center rounded-full transition-colors ${editing ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
            >
              {editing ? <X size={15} /> : <Pencil size={15} />}
            </button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-4">
          <div className="shrink-0">
            <Ring value={(tot.kcal / myGoals.kcal) * 100} size={132} stroke={13}>
              <span className="text-2xl font-extrabold leading-none tracking-tight">{fmt(tot.kcal)}</span>
              <span className={`mt-1 text-[11px] font-semibold ${muted}`}>kcal</span>
            </Ring>
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            {macros.map(([label, k, Icon, color]) => (
              <div key={k}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 font-semibold">
                    <Icon size={13} className={muted} />
                    {label}
                  </span>
                  <span className={muted}>
                    <b className="font-bold text-zinc-950 dark:text-white">{fmt(tot[k])}</b>/{fmt(myGoals[k])}g
                  </span>
                </div>
                <Bar value={(tot[k] / myGoals[k]) * 100} color={color} />
              </div>
            ))}
          </div>
        </div>

        {editing && (
          <form onSubmit={submitGoals} className="mt-5 grid grid-cols-2 gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {[
              ['kcal', 'Calorías (kcal)', Flame],
              ['p', 'Proteína (g)', Beef],
              ['c', 'Carbos (g)', Wheat],
              ['g', 'Grasas (g)', Droplets],
            ].map(([k, label, Icon]) => (
              <label key={k} className="rounded-2xl bg-zinc-200/70 p-2.5 text-xs font-semibold dark:bg-zinc-800/70">
                <span className={`flex items-center gap-1 ${muted}`}>
                  <Icon size={12} /> {label}
                </span>
                <input inputMode="numeric" value={g[k]} onChange={(e) => setG((v) => ({ ...v, [k]: e.target.value }))} className="mt-1 w-full bg-transparent text-base font-extrabold text-zinc-950 outline-none dark:text-white" />
              </label>
            ))}
            <button type="submit" className={`${primary} col-span-2 mt-1 !h-11 !text-sm`}>Guardar objetivo</button>
          </form>
        )}
      </Card>

      <button
        type="button"
        onClick={() => go('progreso')}
        className="flex w-full items-center gap-3 rounded-[24px] bg-zinc-100 p-4 text-left transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
          <Scale size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Peso y medidas</span>
          <span className={`mt-0.5 block truncate text-xs ${muted}`}>
            {latestBodyMetric?.weight ? `Último peso: ${fmt(Number(latestBodyMetric.weight), 1)} kg · ` : ''}
            Registra tu evolución corporal
          </span>
        </span>
        <ChevronRight size={18} className={muted} />
      </button>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Comidas de hoy</h2>
          <span className={`text-xs font-semibold ${muted}`}>
            {list.length} {list.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {list.length === 0 ? (
            <Card className="text-center">
              <Utensils size={20} className={`mx-auto ${muted}`} />
              <p className={`mt-2 text-sm ${muted}`}>Todavía no has registrado comidas en este día.</p>
              {yesterday.length > 0 && (
                <button
                  type="button"
                  onClick={copyYesterday}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-zinc-950 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-zinc-950"
                >
                  <Copy size={13} /> Copiar las {yesterday.length} del día anterior
                </button>
              )}
            </Card>
          ) : (
            list.map((m) => {
              const Icon = mealIcon(m.type);
              return (
                <div key={m.id} className="flex items-center gap-3 rounded-[24px] bg-zinc-100 p-3.5 dark:bg-zinc-900">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-200/80 text-zinc-950 dark:bg-zinc-800 dark:text-white">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[11px] font-bold uppercase tracking-wider ${muted}`}>{m.type}</span>
                      {(m.p > 0 || m.c > 0 || m.g > 0) && (
                        <span className={`text-[11px] ${muted}`}>· {m.p}P · {m.c}C · {m.g}G</span>
                      )}
                    </div>
                    <p className="truncate font-bold">{m.name}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="rounded-full bg-zinc-200/80 px-2.5 py-1 text-xs font-extrabold dark:bg-zinc-800">
                      {fmt(m.kcal)} kcal
                    </span>
                    <button type="button" onClick={() => deleteMeal(m.id)} aria-label={`Eliminar ${m.name}`} className={trash}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-zinc-200 text-zinc-950 dark:bg-zinc-800 dark:text-white">
              {editingRecipes ? <Pencil size={15} /> : <Plus size={16} />}
            </span>
            <p className="font-bold">{editingRecipes ? 'Gestionar recetas' : 'Añadir comida'}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {!editingRecipes && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                aria-label="Escanear código de barras"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-zinc-950 px-3 text-xs font-extrabold text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <ScanBarcode size={14} />
                Escanear
              </button>
            )}
            <button
              type="button"
              onClick={() => { setEditingRecipes(!editingRecipes); setRecipeForm({ id: '', ...blankRecipe }); }}
              aria-label="Gestionar recetas"
              className={`flex size-8 items-center justify-center rounded-full transition-colors ${editingRecipes ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800'}`}
            >
              {editingRecipes ? <X size={16} /> : <Pencil size={16} />}
            </button>
          </div>
        </div>

        {editingRecipes ? (
          <div className="mt-4 space-y-4">
            <form onSubmit={submitRecipe} className="space-y-3 rounded-2xl bg-zinc-200/60 p-3.5 dark:bg-zinc-800/50">
              <p className="text-xs font-bold uppercase tracking-wider">{recipeForm.id ? 'Editando receta' : 'Nueva receta rápida'}</p>

              <div className="grid grid-cols-4 gap-1.5">
                {MEAL_TYPES.map(([t, Icon]) => {
                  const on = recipeForm.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRecipeForm((v) => ({ ...v, type: t }))}
                      className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition-colors ${on ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'bg-white text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300'}`}
                    >
                      <Icon size={14} />
                      {t}
                    </button>
                  );
                })}
              </div>

              <input aria-label="Nombre" placeholder="Nombre del plato" value={recipeForm.name} onChange={setR('name')} className={`${field} w-full bg-white dark:bg-zinc-900`} />
              <input aria-label="Descripción" placeholder="Descripción breve (opcional)" value={recipeForm.desc} onChange={setR('desc')} className={`${field} w-full bg-white dark:bg-zinc-900`} />
              <div className="grid grid-cols-4 gap-2">
                {[['kcal', 'kcal'], ['p', 'Prot.'], ['c', 'Carb.'], ['g', 'Grasa']].map(([k, label]) => (
                  <input key={k} inputMode="decimal" aria-label={label} placeholder={label} value={recipeForm[k]} onChange={setR(k)} className={`${field} w-full min-w-0 bg-white px-2 text-center dark:bg-zinc-900`} />
                ))}
              </div>
              <div className="flex gap-2">
                {recipeForm.id && <button type="button" onClick={() => setRecipeForm({ id: '', ...blankRecipe })} className="h-11 w-full rounded-full bg-zinc-300 text-sm font-bold text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">Cancelar</button>}
                <button type="submit" className={`${primary} !h-11 !text-sm ${!recipeForm.id ? 'w-full' : ''}`}>{recipeForm.id ? 'Guardar' : 'Crear receta'}</button>
              </div>
            </form>

            <div className="space-y-2">
              {recipes.length === 0 && <p className={`text-sm ${muted}`}>No hay recetas guardadas.</p>}
              {recipes.map((r) => {
                const Icon = mealIcon(r.type);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-zinc-200/80 dark:bg-zinc-800">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{r.name}</p>
                        {r.desc && <p className={`truncate text-xs ${muted}`}>{r.desc}</p>}
                        <p className={`text-xs font-semibold ${muted}`}>{r.kcal} kcal · {r.p}g P · {r.c}g C · {r.g}g G</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => editRecipe(r)} aria-label={`Editar ${r.name}`} className="flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-zinc-200 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-white"><Pencil size={15} /></button>
                      <button type="button" onClick={() => deleteRecipe(r.id)} aria-label={`Eliminar ${r.name}`} className={trash}><Trash2 size={15} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className={`text-xs font-semibold uppercase tracking-wider ${muted}`}>Sugerencias rápidas</p>
                {recipes.length > 0 && <span className={`text-[11px] ${muted}`}>Toca para rellenar</span>}
              </div>

              {recipes.length > 0 ? (
                <div className="-mx-5 flex snap-x gap-2.5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recipes.map((r) => {
                    const Icon = mealIcon(r.type);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => loadRecipe(r)}
                        className="w-44 shrink-0 snap-start rounded-2xl bg-zinc-200/80 p-3 text-left transition-colors hover:bg-zinc-300/80 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                      >
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold opacity-70">
                            <Icon size={12} /> {r.type}
                          </span>
                          <span className="text-[11px] font-extrabold">{r.kcal} kcal</span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-bold">{r.name}</p>
                        {r.desc && <p className={`truncate text-xs ${muted}`}>{r.desc}</p>}
                        <p className={`mt-1.5 text-[11px] font-semibold ${muted}`}>{r.p}g P · {r.c}g C · {r.g}g G</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className={`text-sm ${muted}`}>No hay recetas. Toca el lápiz de arriba para añadir una.</p>
              )}
            </div>

            <form onSubmit={submit} className="mt-3 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="grid grid-cols-4 gap-1.5">
                {MEAL_TYPES.map(([t, Icon]) => {
                  const on = f.type === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setF((v) => ({ ...v, type: t }))}
                      aria-pressed={on}
                      className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-bold transition-colors ${on ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950' : 'bg-zinc-200/80 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'}`}
                    >
                      <Icon size={14} />
                      {t}
                    </button>
                  );
                })}
              </div>

              <input aria-label="Qué has comido" placeholder="¿Qué has comido?" value={f.name} onChange={set('name')} className={`${field} w-full`} />

              <div className="grid grid-cols-4 gap-2">
                {[
                  ['kcal', 'kcal', Flame],
                  ['p', 'Prot. g', Beef],
                  ['c', 'Carb. g', Wheat],
                  ['g', 'Grasa g', Droplets],
                ].map(([k, label, Icon]) => (
                  <div key={k} className="relative">
                    <Icon size={12} className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 opacity-50 ${muted}`} />
                    <input
                      inputMode="decimal"
                      aria-label={label}
                      placeholder={label}
                      value={f[k]}
                      onChange={set(k)}
                      className={`${field} w-full min-w-0 pl-7 pr-1.5 text-center text-xs font-semibold`}
                    />
                  </div>
                ))}
              </div>

              <button type="submit" className={`${primary} !h-12`}>Añadir comida</button>
            </form>
          </>
        )}
      </Card>

      {scanning && (
        <BarcodeScanner
          onClose={() => setScanning(false)}
          onSelect={handleScannedProduct}
        />
      )}
    </div>
  );
}