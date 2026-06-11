import { create } from "zustand";

export interface ConversationSummary {
  id: string;
  personaId: string;
  personaName: string;
  title: string;
  lastMessage: string;
  updatedAt: string;
}

interface ConversationState {
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  setConversations: (conversations: ConversationSummary[]) => void;
  setActiveConversation: (id: string | null) => void;
  removeConversation: (id: string) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  removeConversation: (id) =>
    set((state) => ({
      conversations: state.conversations.filter((c) => c.id !== id),
    })),
}));
