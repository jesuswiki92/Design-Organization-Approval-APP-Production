'use client'

import { create } from 'zustand'

type SidePanelContent = 'ai-expert' | 'project-form' | 'client-form' | 'document-form' | 'task-form' | null

interface UIState {
  sidebarCollapsed: boolean
  sidePanelOpen: boolean
  sidePanelContent: SidePanelContent
  activeProjectId: string | null
  toggleSidebar: () => void
  openSidePanel: (content: SidePanelContent, projectId?: string) => void
  closeSidePanel: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  sidePanelOpen: false,
  sidePanelContent: null,
  activeProjectId: null,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openSidePanel: (content, projectId) =>
    set({ sidePanelOpen: true, sidePanelContent: content, activeProjectId: projectId ?? null }),
  closeSidePanel: () =>
    set({ sidePanelOpen: false, sidePanelContent: null }),
}))
