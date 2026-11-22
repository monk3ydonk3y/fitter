import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_ROUTINES, friendCodeOf, generateFriendCode } from './lib';

const DEFAULT_RECIPES = [
  { id: 'r1', name: 'Tortitas de avena', desc: 'Avena, claras y plátano batido', type: 'Desayuno', kcal: 350, p: 20, c: 45, g: 8 },
  { id: 'r2', name: 'Pollo, arroz y brócoli', desc: 'Comida clásica de volumen', type: 'Comida', kcal: 450, p: 40, c: 55, g: 5 },
  { id: 'r3', name: 'Yogur proteico y nueces', desc: 'Yogur natural con un puñado de nueces', type: 'Merienda', kcal: 250, p: 20, c: 10, g: 14 },
  { id: 'r4', name: 'Salmón a la plancha', desc: 'Con guarnición de espárragos', type: 'Cena', kcal: 400, p: 35, c: 0, g: 25 },
];

const defaultGoals = { kcal: 2400, p: 160, c: 260, g: 70, weekly: { Pecho: 16, Espalda: 16, Piernas: 14, Hombro: 12, Brazos: 10 } };
const withoutDefaultFriends = (friends = []) => friends.filter((friend) => friend.id !== 'f-carlos' && friend.id !== 'f-elena');
const blank = (user) => ({
  routines: DEFAULT_ROUTINES,
  sessions: [],
  meals: [],
  recipes: DEFAULT_RECIPES,
  goals: defaultGoals,
  cravings: {},
  exerciseNotes: {},
  draft: null,
  friends: [],
  reactions: {},
  bodyMetrics: [],
  friendCode: friendCodeOf(user),
});

// Datos de la versión con perfiles: se pasan una sola vez a la primera cuenta que se cree.
const migrateLegacy = (user) => {
  try {
    const old = JSON.parse(localStorage.getItem('gym-data'));
    if (!old || localStorage.getItem('gym-legacy-done')) return null;
    localStorage.setItem('gym-legacy-done', '1');
    const pid = old.activeProfileId || 'p1';
    const mine = (x) => !x.profileId || x.profileId === pid;
    const goals = old.goals?.[pid] || old.goals?.p1 || old.goals || {};
    return {
      ...blank(user),
      routines: old.routines || DEFAULT_ROUTINES,
      recipes: old.recipes || DEFAULT_RECIPES,
      sessions: (old.sessions || []).filter(mine),
      meals: (old.meals || []).filter(mine),
      goals: { ...defaultGoals, ...goals },
      cravings: old.cravings?.[pid] || {},
    };
  } catch { return null; }
};

const Ctx = createContext(null);

export const GymProvider = ({ user, logout, children }) => {
  const key = `gym-data:${user.id}`;
  const [data, setData] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved) return {
        ...blank(user),
        ...saved,
        friends: withoutDefaultFriends(saved.friends),
        bodyMetrics: Array.isArray(saved.bodyMetrics) ? saved.bodyMetrics : [],
        friendCode: saved.friendCode || friendCodeOf(user),
      };
    } catch { /* datos corruptos: se empieza de cero */ }
    return migrateLegacy(user) || blank(user);
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(data));
    try {
      const users = JSON.parse(localStorage.getItem('gym-users')) || [];
      const idx = users.findIndex((u) => u.id === user.id);
      if (idx !== -1 && data.friendCode && users[idx].friendCode !== data.friendCode) {
        users[idx] = { ...users[idx], friendCode: data.friendCode };
        localStorage.setItem('gym-users', JSON.stringify(users));
      }
    } catch { /* ignorar error de almacenamiento */ }
  }, [key, data, user.id]);

  const up = (fn) => setData((d) => ({ ...d, ...fn(d) }));
  const api = {
    ...data,
    user,
    logout,
    addSession: (s) => up((d) => ({ sessions: [...d.sessions, { id: crypto.randomUUID(), ...s }], draft: null })),
    updateSession: (id, fn) => up((d) => ({ sessions: d.sessions.map((s) => (s.id === id ? { ...s, ...fn(s) } : s)) })),
    deleteSession: (id) => up((d) => ({ sessions: d.sessions.filter((s) => s.id !== id) })),
    addMeal: (m) => up((d) => ({ meals: [...d.meals, { id: crypto.randomUUID(), ...m }] })),
    deleteMeal: (id) => up((d) => ({ meals: d.meals.filter((m) => m.id !== id) })),
    saveRoutines: (routines) => up(() => ({ routines })),
    saveGoals: (goals) => up((d) => ({ goals: { ...d.goals, ...goals } })),
    saveRecipes: (recipes) => up(() => ({ recipes })),
    saveBodyMetric: (metric, originalDate) => up((d) => ({
      bodyMetrics: [
        ...(d.bodyMetrics || []).filter((entry) => entry.date !== originalDate && entry.date !== metric.date),
        metric,
      ],
    })),
    deleteBodyMetric: (date) => up((d) => ({
      bodyMetrics: (d.bodyMetrics || []).filter((entry) => entry.date !== date),
    })),
    saveDraft: (draft) => up(() => ({ draft })),
    saveCraving: (date, text) => up((d) => {
      const next = { ...d.cravings };
      if (text.trim()) next[date] = text.trim(); else delete next[date];
      return { cravings: next };
    }),
    // Notas fijas por ejercicio: { [nombreEjercicio]: texto }
    saveExerciseNote: (exName, text) => up((d) => {
      const next = { ...(d.exerciseNotes || {}) };
      const clean = text.trim();
      if (clean) next[exName] = clean;
      else delete next[exName];
      return { exerciseNotes: next };
    }),
    regenerateFriendCode: () => up(() => ({ friendCode: generateFriendCode() })),
    addFriend: (friend) => up((d) => {
      const list = d.friends || [];
      if (list.some((f) => f.id === friend.id || (friend.userId && f.userId === friend.userId))) return {};
      return { friends: [friend, ...list] };
    }),
    removeFriend: (id) => up((d) => ({
      friends: (d.friends || []).filter((f) => f.id !== id),
    })),
    toggleReaction: (friendId, emoji) => up((d) => {
      const prev = d.reactions || {};
      const current = prev[friendId] || {};
      return {
        reactions: {
          ...prev,
          [friendId]: { ...current, [emoji]: !current[emoji] },
        },
      };
    }),
    exportData: () => {
      const blob = new Blob([JSON.stringify({ app: 'gym', version: 2, data }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `gym-copia-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    importData: (text) => {
      const parsed = JSON.parse(text);
      const incoming = parsed?.data;
      if (parsed?.app !== 'gym' || !incoming || !Array.isArray(incoming.sessions)) throw new Error('El archivo no es una copia válida.');
      setData({
        ...blank(user),
        ...incoming,
        bodyMetrics: Array.isArray(incoming.bodyMetrics) ? incoming.bodyMetrics : [],
      });
    },
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export const useGym = () => useContext(Ctx);