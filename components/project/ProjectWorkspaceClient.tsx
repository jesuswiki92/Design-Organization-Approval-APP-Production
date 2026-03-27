'use client'

import { useMemo, useState } from 'react'

import { TopBar } from '@/components/layout/TopBar'
import type { ProyectoConRelaciones, ProyectoDocumento, ProyectoTarea } from '@/types/database'

import { ProjectDocumentsTable } from './ProjectDocumentsTable'
import { ProjectExpertPanel } from './ProjectExpertPanel'
import { ProjectWorkspaceHeader } from './ProjectWorkspaceHeader'
import type { ExpertMode } from './workspace-utils'

export function ProjectWorkspaceClient({
  project,
  docs,
  tasks,
}: {
  project: ProyectoConRelaciones
  docs: ProyectoDocumento[]
  tasks: ProyectoTarea[]
}) {
  const [selectedDocId, setSelectedDocId] = useState<string | null>(docs[0]?.id ?? null)
  const [density, setDensity] = useState<'compact' | 'detailed'>('compact')
  const [expertMode, setExpertMode] = useState<ExpertMode>('overview')

  const selectedDoc = useMemo(
    () => docs.find((doc) => doc.id === selectedDocId) ?? null,
    [docs, selectedDocId],
  )

  function openExpert(mode: ExpertMode, doc?: ProyectoDocumento) {
    if (doc) setSelectedDocId(doc.id)
    setExpertMode(mode)
  }

  async function copyReference() {
    await navigator.clipboard.writeText(`${project.numero_proyecto} — ${project.titulo}`)
  }

  return (
    <div className="flex h-full flex-col bg-[#0B1220]">
      <TopBar title={project.numero_proyecto} subtitle={project.titulo} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1800px] flex-col gap-6 p-6">
          <ProjectWorkspaceHeader
            project={project}
            docsCount={docs.length}
            tasksCount={tasks.length}
            onOpenExpert={() => openExpert('overview')}
            onCreateTask={() => openExpert('next')}
            onRegisterHour={() => openExpert('overview')}
            onCopyReference={copyReference}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="min-w-0">
              <ProjectDocumentsTable
                docs={docs}
                selectedDocId={selectedDocId}
                density={density}
                onDensityChange={setDensity}
                onSelectDoc={(doc) => {
                  setSelectedDocId(doc.id)
                  setExpertMode('document')
                }}
                onAskExpert={(doc) => openExpert('document', doc)}
              />
            </div>

            <ProjectExpertPanel
              project={project}
              docs={docs}
              tasks={tasks}
              selectedDoc={selectedDoc}
              mode={expertMode}
              onModeChange={setExpertMode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
