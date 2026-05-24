import { create } from 'zustand';
import {
  listChildren,
  createChild,
  fetchMe,
  setAuthLocal,
  getAuthToken,
  getAuthEmail,
} from '../utils/api';

// Maps UI age-card ids → backend AgeBand enum (uses en-dash characters)
const AGE_BAND_MAP = {
  '6-12mo': '6–12 months',
  '1-2y':   '1–2 years',
  '2-4y':   '2–4 years',
  '4-6y':   '4–6 years',
};

// Maps UI gender → backend Gender enum
const GENDER_MAP = { boy: 'Boy', girl: 'Girl' };

// Maps UI diet → backend DietType enum
const DIET_MAP = {
  vegetarian: 'Pure Veg',
  'pure-veg': 'Pure Veg',
  'veg-eggs': 'Veg + Eggs',
  jain: 'Jain',
};

const COLOR_CLASSES = ['color-1', 'color-2', 'color-3'];

const useStore = create((set, get) => ({
  // ── Auth ─────────────────────────────────────────────────
  authToken: getAuthToken(),
  authEmail: getAuthEmail(),
  authChecked: false,

  // 'signup' = new user setting up first child after OTP
  // 'signin' = returning user with existing profile(s); after OTP, go straight to home/kid-selector
  authIntent: 'signup',
  setAuthIntent: (intent) => set({ authIntent: intent }),

  setAuth: ({ token, email }) => {
    setAuthLocal(token, email);
    set({ authToken: token, authEmail: email, authChecked: true });
  },

  logout: () => {
    setAuthLocal(null, null);
    set({
      authToken: null,
      authEmail: null,
      kids: [],
      activeKidId: null,
      isOnboarded: false,
      currentScreen: 'splash',
      botMessages: [],
      recentScans: [],
      selectedProduct: null,
    });
  },

  bootstrapAuth: async () => {
    const token = getAuthToken();
    if (!token) {
      set({ authChecked: true });
      return;
    }
    // Validate stored token with /auth/me — if rejected, clear
    const me = await fetchMe();
    if (me?.authenticated) {
      set({ authChecked: true, authEmail: me.email });
    } else {
      setAuthLocal(null, null);
      set({ authChecked: true, authToken: null, authEmail: null });
    }
  },

  // ── Navigation ────────────────────────────────────────────
  currentScreen: 'splash',
  previousScreen: null,
  navigate: (screen) =>
    set((s) => ({ previousScreen: s.currentScreen, currentScreen: screen })),

  // ── Kids ─────────────────────────────────────────────────
  kids: [],            // [{ id, name, age, age_band, ageDisplay, allergies[], diets[], initial, colorClass }]
  activeKidId: null,
  hasMultipleKids: false,
  isOnboarded: false,

  loadKidsFromServer: async ({ navigateOnLoad = true } = {}) => {
    try {
      const remote = await listChildren();
      if (Array.isArray(remote) && remote.length > 0) {
        const kids = remote.map((c, i) => ({
          id: c.id,
          name: c.name,
          age_band: c.age_band,
          ageDisplay: c.age_band,
          gender: c.gender,
          diet_type: c.diet_type,
          allergies: c.allergies || [],
          diets: c.diet_type ? [c.diet_type] : [],
          initial: (c.name || '?')[0]?.toUpperCase() || '?',
          colorClass: COLOR_CLASSES[i % COLOR_CLASSES.length],
        }));
        const next = {
          kids,
          activeKidId: kids[0].id,
          hasMultipleKids: kids.length > 1,
          isOnboarded: true,
        };
        // Only auto-navigate when called from a "bootstrap on app load" path —
        // explicit auth/onboarding flows decide their own destination.
        if (navigateOnLoad) next.currentScreen = 'home';
        set(next);
        return kids.length;
      }
      return 0;
    } catch (err) {
      console.warn('[store] could not load kids from server:', err);
      return 0;
    }
  },

  addKidFromForm: async (form) => {
    // form: { name, age, gender, allergies, diets, dietNotes }
    const age_band = AGE_BAND_MAP[form.age] || '1–2 years';
    const gender   = GENDER_MAP[form.gender] || 'Girl';
    const dietKey  = (form.diets && form.diets[0]) || 'vegetarian';
    const diet_type = DIET_MAP[dietKey] || 'Pure Veg';

    const profile = {
      name: form.name || 'My Child',
      age_band,
      gender,
      diet_type,
      allergies: form.allergies || [],
      goals: [],
      cuisine: form.dietNotes || null,
    };
    try {
      const created = await createChild(profile);
      const kids = get().kids;
      const newKid = {
        id: created.id,
        name: created.name,
        age_band: created.age_band,
        ageDisplay: form.age,
        gender: created.gender,
        diet_type: created.diet_type,
        allergies: created.allergies || form.allergies || [],
        diets: form.diets || [],
        initial: (created.name || '?')[0]?.toUpperCase() || '?',
        colorClass: COLOR_CLASSES[kids.length % COLOR_CLASSES.length],
      };
      set({
        kids: [...kids, newKid],
        activeKidId: newKid.id,
        hasMultipleKids: kids.length + 1 > 1,
        isOnboarded: true,
      });
      return newKid;
    } catch (err) {
      console.error('[store] addKid failed:', err);
      throw err;
    }
  },

  setActiveKid: (id) => set({ activeKidId: id }),
  getActiveKid: () => {
    const { kids, activeKidId } = get();
    return kids.find((k) => k.id === activeKidId) || kids[0] || null;
  },

  // ── Onboarding form ──────────────────────────────────────
  onboardForm: { name: '', age: '', gender: '', allergies: [], allergiesOther: '', diets: [], dietNotes: '' },
  updateOnboardForm: (partial) =>
    set((s) => ({ onboardForm: { ...s.onboardForm, ...partial } })),
  resetOnboardForm: () =>
    set({ onboardForm: { name: '', age: '', gender: '', allergies: [], allergiesOther: '', diets: [], dietNotes: '' } }),

  // ── Scanning ─────────────────────────────────────────────
  scanMethod: 'barcode',          // 'barcode' | 'photo' | 'link'
  setScanMethod: (m) => set({ scanMethod: m }),

  selectedProduct: null,           // { product, score, source } from backend
  recentScans: [],                 // local-only quick-access list (last 5 selectedProducts)

  setSelectedProduct: (scanResult) =>
    set((s) => {
      const id =
        scanResult?.product?.barcode ||
        scanResult?.product?.name + '-' + (scanResult?.product?.brand || '');
      const existing = s.recentScans.filter((r) => {
        const rid = r?.product?.barcode || r?.product?.name + '-' + (r?.product?.brand || '');
        return rid !== id;
      });
      return {
        selectedProduct: scanResult,
        recentScans: [scanResult, ...existing].slice(0, 5),
      };
    }),

  servingMode: 'serving',
  setServingMode: (mode) => set({ servingMode: mode }),

  // ── Bot ───────────────────────────────────────────────────
  botMessages: [],
  addBotMessage: (msg) =>
    set((s) => {
      if (msg.id && s.botMessages.some((m) => m.id === msg.id)) return s;
      return { botMessages: [...s.botMessages, msg] };
    }),
  clearBotMessages: () => set({ botMessages: [] }),
}));

export default useStore;
