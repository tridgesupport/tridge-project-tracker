import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { ToWords } from 'to-words'
import { formatInvoiceDate } from '@/lib/invoice-number'
import { LOGO_PNG_BASE64, ARCH_PNG_BASE64 } from '@/lib/invoice-assets'

const BLUE = '#1F6FB2'
const ORANGE = '#ED7D31'
const GREEN = '#3CB878'

const styles = StyleSheet.create({
  page: { padding: 40, paddingTop: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#222' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  logo: { width: 110 },
  companyBlock: { alignItems: 'flex-end' },
  companyName: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 6, textAlign: 'right' },
  companyLine: { fontSize: 9, color: '#333', marginBottom: 2, textAlign: 'right' },
  greenBar: { height: 5, backgroundColor: GREEN, marginTop: 14, marginBottom: 18 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  metaLabel: { fontFamily: 'Helvetica-Bold', color: BLUE, fontSize: 9.5 },
  metaText: { fontSize: 9.5, marginBottom: 2 },
  invoiceHeading: { fontSize: 28, fontFamily: 'Helvetica-Bold', color: ORANGE },
  toLabel: { fontFamily: 'Helvetica-Bold', color: BLUE, fontSize: 9.5, marginBottom: 4 },
  toName: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginBottom: 2 },
  toLine: { fontSize: 9.5, marginBottom: 1 },
  tableSection: { marginTop: 20, position: 'relative' },
  archImage: { position: 'absolute', top: 28, left: 40, width: 420, opacity: 0.35 },
  tableHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: BLUE,
    paddingBottom: 4, marginBottom: 6,
  },
  tableHeaderDesc: { flex: 1, fontFamily: 'Helvetica-Bold', color: BLUE, fontSize: 9.5 },
  tableHeaderAmount: { fontFamily: 'Helvetica-Bold', color: BLUE, fontSize: 9.5, textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 5 },
  descCell: { flex: 1, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  amountCell: { fontSize: 9.5, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row', paddingTop: 8, marginTop: 4,
    borderTopWidth: 1, borderTopColor: '#ccc',
  },
  totalLabel: { flex: 1, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  totalValue: { fontSize: 9.5, textAlign: 'right' },
  wordsRow: { flexDirection: 'row', paddingTop: 6, borderBottomWidth: 1, borderBottomColor: '#ccc', paddingBottom: 10 },
  wordsLabel: { flex: 1, fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  wordsValue: { fontSize: 9.5, textAlign: 'right', maxWidth: 220 },
  notes: { marginTop: 18 },
  noteLine: { fontSize: 9, marginBottom: 4 },
  bankBlock: { fontSize: 9, marginBottom: 4, marginLeft: 8 },
})

const toWords = new ToWords({ localeCode: 'en-IN' })

export interface InvoicePdfData {
  invoiceNumber: string
  invoiceDate: Date
  toName: string
  toAddress: string | null
  gstin: string | null
  descriptionLabel: string
  monthLabel: string
  amount: number
  bankDetails?: string | null
}

function InvoiceDocument({ data }: { data: InvoicePdfData }) {
  const amountText = `INR ${data.amount.toFixed(2)}`
  const amountInWords = `${toWords.convert(data.amount, { currency: true })}`
  const description = `${data.descriptionLabel} for ${data.monthLabel}`
  const addressLines = (data.toAddress || '').split('\n').filter(Boolean)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF primitive, not an <img> */}
          <Image src={LOGO_PNG_BASE64} style={styles.logo} />
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>Tridge Talentreprenurship Software Pvt. Ltd.</Text>
            <Text style={styles.companyLine}>CIN: U72900MH2021PTC363321</Text>
            <Text style={styles.companyLine}>PAN: AAICT7102R</Text>
            <Text style={styles.companyLine}>39, Everest, 12 Peddar Road, Mumbai 400026</Text>
            <Text style={styles.companyLine}>Phone: +919820526174; Email: hardik@tridge.co.in</Text>
          </View>
        </View>
        <View style={styles.greenBar} />

        <View style={styles.titleRow}>
          <View>
            <Text style={styles.metaText}><Text style={styles.metaLabel}>INVOICE </Text>#{data.invoiceNumber}</Text>
            <Text style={styles.metaText}><Text style={styles.metaLabel}>DATE: </Text>{formatInvoiceDate(data.invoiceDate)}</Text>
            <View style={{ marginTop: 14 }}>
              <Text style={styles.toLabel}>TO:</Text>
              <Text style={styles.toName}>{data.toName}</Text>
              {addressLines.map((line, i) => <Text key={i} style={styles.toLine}>{line}</Text>)}
              {data.gstin && <Text style={styles.toLine}>GST NO: {data.gstin}</Text>}
            </View>
          </View>
          <Text style={styles.invoiceHeading}>INVOICE</Text>
        </View>

        <View style={styles.tableSection}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image is a PDF primitive, not an <img> */}
          <Image src={ARCH_PNG_BASE64} style={styles.archImage} />
          <View style={styles.tableHeaderRow}>
            <Text style={styles.tableHeaderDesc}>Description</Text>
            <Text style={styles.tableHeaderAmount}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.descCell}>{description}</Text>
            <Text style={styles.amountCell}>{amountText}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>{amountText}</Text>
          </View>
          <View style={styles.wordsRow}>
            <Text style={styles.wordsLabel}>Total Amount in Words</Text>
            <Text style={styles.wordsValue}>{amountInWords}</Text>
          </View>
        </View>

        <View style={styles.notes}>
          <Text style={styles.noteLine}>Please make all checks payable to the company name.</Text>
          <Text style={styles.noteLine}>In case of wire transfer, please note details below:</Text>
          {data.bankDetails && data.bankDetails.split('\n').filter(Boolean).map((line, i) => (
            <Text key={i} style={styles.bankBlock}>{line}</Text>
          ))}
          <Text style={styles.noteLine}>Payment is due within 30 days.</Text>
          <Text style={styles.noteLine}>
            If you have any questions concerning this invoice, contact Hardik | 9820526174 | support@tridge.co.in
          </Text>
          <Text style={styles.noteLine}>It was a pleasure doing business with you.</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderInvoicePDF(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />)
}
