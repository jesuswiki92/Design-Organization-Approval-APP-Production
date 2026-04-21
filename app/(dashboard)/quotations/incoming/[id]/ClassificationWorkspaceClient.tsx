'use client'

import { useCallback, useState } from 'react'
import ClassificationChatPanel from './ClassificationChatPanel'
import type { Answer, LogEntry } from './ClassificationChatPanel'
import ChangeClassificationPanel from './ChangeClassificationPanel'
import ModificationDescriptionPanel from './ModificationDescriptionPanel'

type WeightItem = {
  item: string
  weight_added_kg: number
  weight_removed_kg: number
}

type ClassificationData = {
  items_weight_list?: WeightItem[] | null
  fuselage_position?: string | null
  sta_location?: string | null
  impact_location?: string | null
  affects_primary_structure?: string | null
  impact_structural_attachment?: string | null
  estimated_weight_kg?: string | null
  related_to_ad?: string | null
  ad_reference?: string | null
  mtow_kg?: number | null
}

type ModificationData = {
  aircraft_manufacturer?: string | null
  aircraft_model?: string | null
  aircraft_msn?: string | null
  tcds_number?: string | null
  work_type?: string | null
  modification_summary?: string | null
  operational_goal?: string | null
  impact_location?: string | null
  impact_structural_attachment?: string | null
  impact_structural_interface?: string | null
  impact_electrical?: string | null
  impact_avionics?: string | null
  impact_cabin_layout?: string | null
  impact_pressurized?: string | null
  impact_operational_change?: string | null
  estimated_weight_kg?: number | string | null
  items_weight_list?: WeightItem[] | null
  fuselage_position?: string | null
  sta_location?: string | null
  affects_primary_structure?: string | null
  related_to_ad?: string | null
  ad_reference?: string | null
  mtow_kg?: number | null
  additional_notes?: string | null
}

type Props = {
  consultaId: string
  referenceProjectId: string | null
  classificationData?: ClassificationData
  consultationData: ModificationData
  clientEmail?: string
  clientName?: string
  numeroEntrada?: string
  sender?: string
  subject?: string
}

export default function ClassificationWorkspaceClient({
  consultaId,
  referenceProjectId,
  classificationData,
  consultationData,
  clientEmail,
  clientName,
  numeroEntrada,
  sender,
  subject,
}: Props) {
  const [currentAnswers, setCurrentAnswers] = useState<Answer[]>([])
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  const handleAnswersChange = useCallback((answers: Answer[]) => {
    setCurrentAnswers(answers)
  }, [])

  const handleLogEntry = useCallback((message: string, type: LogEntry['type']) => {
    setLogEntries((prev) => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        message,
        type,
      },
    ])
  }, [])

  const handleClearLog = useCallback(() => {
    setLogEntries([])
  }, [])

  const handleAnalyzingChange = useCallback((value: boolean) => {
    setAnalyzing(value)
  }, [])

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ClassificationChatPanel
          consultaId={consultaId}
          currentAnswers={currentAnswers}
          logEntries={logEntries}
          onClearLog={handleClearLog}
          analyzing={analyzing}
          clientEmail={clientEmail}
          clientName={clientName}
          numeroEntrada={numeroEntrada}
          sender={sender}
          subject={subject}
        />

        <ChangeClassificationPanel
          consultaId={consultaId}
          referenceProjectId={referenceProjectId}
          classificationData={classificationData}
          onAnswersChange={handleAnswersChange}
          onLogEntry={handleLogEntry}
          onAnalyzingChange={handleAnalyzingChange}
        />
      </div>

      <ModificationDescriptionPanel
        consultationId={consultaId}
        consultationData={consultationData}
      />
    </div>
  )
}
