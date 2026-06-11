import { create } from "zustand";
import type { Persona } from "../modules/persona/types";

interface PersonaState {
  personas: Persona[];
  activePersonaId: string | null;
  setPersonas: (personas: Persona[]) => void;
  setActivePersona: (id: string | null) => void;
}

export const usePersonaStore = create<PersonaState>((set) => ({
  personas: [],
  activePersonaId: null,
  setPersonas: (personas) => set({ personas }),
  setActivePersona: (id) => set({ activePersonaId: id }),
}));
