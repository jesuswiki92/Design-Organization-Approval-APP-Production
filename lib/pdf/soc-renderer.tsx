/**
 * ============================================================================
 * Statement of Compliance PDF renderer — Sprint 3
 * ============================================================================
 *
 * Renders a canonical `StatementOfCompliancePayload` into a PDF buffer using
 * @react-pdf/renderer's `renderToBuffer`. The visual layout is intended to
 * look like an aviation Part 21J SoC: company letterhead, document id, a
 * project block, a validation block (DOH/DOS), a deliverables table, a
 * compliance boilerplate referencing Part 21J 21.A.239/257/263, and a
 * signature footer with HMAC evidence.
 *
 * This file is a React server module (JSX) — it is `'server-only'` and must
 * not be imported by client components.
 */

import 'server-only'

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer'

import type { StatementOfCompliancePayload } from '@/types/database'

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    color: '#1e293b',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f172a',
  },
  companyBlock: {
    flexDirection: 'column',
  },
  companyName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  companyApproval: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  docBlock: {
    alignItems: 'flex-end',
  },
  docTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  docId: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  h2: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  kvRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  kvKey: {
    width: 110,
    color: '#64748b',
  },
  kvValue: {
    flex: 1,
    color: '#0f172a',
  },
  descriptionBlock: {
    marginTop: 4,
    padding: 6,
    backgroundColor: '#f8fafc',
    borderLeftWidth: 2,
    borderLeftColor: '#94a3b8',
    color: '#334155',
  },
  table: {
    marginTop: 6,
    borderWidth: 0.5,
    borderColor: '#cbd5e1',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 0.5,
    borderBottomColor: '#94a3b8',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e2e8f0',
  },
  th: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    padding: 5,
  },
  td: {
    fontSize: 9,
    padding: 5,
    color: '#1e293b',
  },
  col_titulo: { flex: 3 },
  col_code: { flex: 1.2 },
  col_sub: { flex: 1 },
  col_ver: { width: 34, textAlign: 'right' },
  col_estado: { flex: 1 },
  boilerplate: {
    marginTop: 10,
    padding: 8,
    fontSize: 9.5,
    lineHeight: 1.4,
    backgroundColor: '#f1f5f9',
    color: '#1e293b',
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#64748b',
  },
  sigBlock: {
    marginTop: 12,
    padding: 8,
    borderWidth: 0.5,
    borderColor: '#0f172a',
  },
  sigTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0f172a',
  },
  sigMono: {
    fontFamily: 'Courier',
    fontSize: 9,
    color: '#0f172a',
  },
})

function formatDateHuman(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    })
  } catch {
    return iso
  }
}

function StatementOfComplianceDocument({
  payload,
}: {
  payload: StatementOfCompliancePayload
}) {
  return (
    <Document
      title={payload.document.title}
      author={payload.document.company.name}
      subject={`Statement of Compliance — ${payload.proyecto.numero_proyecto}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>{payload.document.company.name}</Text>
            <Text style={styles.companyApproval}>
              EASA Part 21J Approval: {payload.document.company.approval_no}
            </Text>
          </View>
          <View style={styles.docBlock}>
            <Text style={styles.docTitle}>{payload.document.title}</Text>
            <Text style={styles.docId}>Doc ID: {payload.document.id}</Text>
            <Text style={styles.docId}>
              Issued: {formatDateHuman(payload.document.generated_at)} UTC
            </Text>
          </View>
        </View>

        {/* Project block */}
        <Text style={styles.h2}>Project</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Project no.</Text>
          <Text style={styles.kvValue}>{payload.proyecto.numero_proyecto}</Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Title</Text>
          <Text style={styles.kvValue}>{payload.proyecto.titulo}</Text>
        </View>
        {payload.proyecto.cliente_nombre && (
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Client</Text>
            <Text style={styles.kvValue}>{payload.proyecto.cliente_nombre}</Text>
          </View>
        )}
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Project UUID</Text>
          <Text style={styles.kvValue}>{payload.proyecto.id}</Text>
        </View>
        {payload.proyecto.descripcion && (
          <View style={styles.descriptionBlock}>
            <Text>{payload.proyecto.descripcion}</Text>
          </View>
        )}

        {/* Validation block */}
        <Text style={styles.h2}>Validation</Text>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Decision</Text>
          <Text style={styles.kvValue}>
            {payload.validation.decision.toUpperCase()}
          </Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Role</Text>
          <Text style={styles.kvValue}>
            {payload.validation.role.toUpperCase()}
          </Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Validator</Text>
          <Text style={styles.kvValue}>
            {payload.validation.validator_email ??
              payload.validation.validator_user_id}
          </Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Decided at</Text>
          <Text style={styles.kvValue}>
            {formatDateHuman(payload.validation.decided_at)} UTC
          </Text>
        </View>
        <View style={styles.kvRow}>
          <Text style={styles.kvKey}>Validation ID</Text>
          <Text style={styles.kvValue}>{payload.validation.id}</Text>
        </View>

        {/* Deliverables table */}
        <Text style={styles.h2}>Deliverables</Text>
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.col_titulo]}>Titulo</Text>
            <Text style={[styles.th, styles.col_code]}>Template</Text>
            <Text style={[styles.th, styles.col_sub]}>Subpart EASA</Text>
            <Text style={[styles.th, styles.col_ver]}>Ver.</Text>
            <Text style={[styles.th, styles.col_estado]}>Estado</Text>
          </View>
          {payload.deliverables.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { flex: 1, fontStyle: 'italic' }]}>
                (No deliverables captured.)
              </Text>
            </View>
          ) : (
            payload.deliverables.map((d) => (
              <View style={styles.tableRow} key={d.id}>
                <Text style={[styles.td, styles.col_titulo]}>{d.titulo}</Text>
                <Text style={[styles.td, styles.col_code]}>
                  {d.template_code ?? '-'}
                </Text>
                <Text style={[styles.td, styles.col_sub]}>
                  {d.subpart_easa ?? '-'}
                </Text>
                <Text style={[styles.td, styles.col_ver]}>
                  {d.version_actual}
                </Text>
                <Text style={[styles.td, styles.col_estado]}>{d.estado}</Text>
              </View>
            ))
          )}
        </View>

        {/* Compliance boilerplate */}
        <View style={styles.boilerplate}>
          <Text>
            The {payload.document.company.name} Design Organisation hereby
            declares, under {payload.compliance_reference.regulation} (clauses{' '}
            {payload.compliance_reference.clauses.join(', ')}), that the design
            data listed above has been produced, reviewed and validated by its
            authorised Office of Airworthiness (DOH) / Office of Design
            Satisfaction (DOS), and that it complies with the applicable
            certification basis and environmental protection requirements. This
            Statement of Compliance, together with the HMAC-signed validation
            record referenced below, constitutes the non-repudiable evidence of
            design compliance for the referenced project.
          </Text>
        </View>

        {/* Signature footer */}
        <View style={styles.sigBlock}>
          <Text style={styles.sigTitle}>Signature evidence</Text>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Signed by</Text>
            <Text style={styles.kvValue}>
              {payload.signature.signed_by_user_id}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Signed at</Text>
            <Text style={styles.kvValue}>
              {formatDateHuman(payload.signature.signed_at)} UTC
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>Signature ID</Text>
            <Text style={styles.kvValue}>
              {payload.signature.validation_signature_id}
            </Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>HMAC key id</Text>
            <Text style={styles.kvValue}>{payload.signature.hmac_key_id}</Text>
          </View>
          <View style={styles.kvRow}>
            <Text style={styles.kvKey}>HMAC (first/last 8)</Text>
            <Text style={[styles.kvValue, styles.sigMono]}>
              {payload.signature.hmac_signature_first8}
              {'...'}
              {payload.signature.hmac_signature_last8}
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>
            {payload.document.company.name} · {payload.document.company.approval_no}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${payload.document.id}  ·  ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

/**
 * Render a Statement of Compliance payload into a PDF buffer.
 *
 * Throws if `@react-pdf/renderer` cannot be resolved (e.g. dependency not
 * installed) — callers should treat this as an internal server error.
 */
export async function renderStatementOfCompliance(
  payload: StatementOfCompliancePayload,
): Promise<Buffer> {
  return renderToBuffer(<StatementOfComplianceDocument payload={payload} />)
}
