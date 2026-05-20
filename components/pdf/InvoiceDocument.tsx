// NO "use client" — this file runs in Node.js via renderToBuffer ONLY.
// DO NOT add "use client" — doing so causes "PDFDocument is not a constructor" errors.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const NAVY = "#1e3a5f";
const NAVY_LIGHT = "#2c5282";
const GRAY = "#6b7280";
const GRAY_LIGHT = "#f3f4f6";
const BORDER = "#e5e7eb";
const BLACK = "#111827";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, color: BLACK, backgroundColor: "#ffffff" },

  // Header band
  header: { backgroundColor: NAVY, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 24 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#ffffff", marginBottom: 4 },
  companyTagline: { fontSize: 9, color: "#93c5fd", marginBottom: 10 },
  companyAddress: { fontSize: 8, color: "#cbd5e1" },

  // Invoice meta row
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: 40, paddingTop: 24, paddingBottom: 16 },
  invoiceTitle: { fontSize: 26, fontFamily: "Helvetica-Bold", color: NAVY, letterSpacing: 1 },
  invoiceSubtitle: { fontSize: 9, color: GRAY, marginTop: 2 },
  metaTable: { alignItems: "flex-end" },
  metaLine: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { fontSize: 9, color: GRAY, width: 72, textAlign: "right", marginRight: 8 },
  metaValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLACK, width: 88, textAlign: "right" },

  // Section
  sectionPad: { paddingHorizontal: 40 },
  sectionTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY_LIGHT, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },

  // Bill-to card
  billToCard: { backgroundColor: GRAY_LIGHT, borderRadius: 4, padding: 12, marginBottom: 20 },
  billToName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BLACK, marginBottom: 3 },
  billToDetail: { fontSize: 9, color: GRAY, marginBottom: 2 },

  // Services table
  tableHeaderRow: { flexDirection: "row", backgroundColor: NAVY, borderRadius: 3, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 0 },
  tableHeaderCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  tableRow: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  tableRowAlt: { flexDirection: "row", paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: BORDER, backgroundColor: GRAY_LIGHT },
  cellDesc: { flex: 3, fontSize: 9, color: BLACK },
  cellRate: { flex: 1.5, fontSize: 9, color: BLACK, textAlign: "right" },
  cellQty: { flex: 1, fontSize: 9, color: BLACK, textAlign: "center" },
  cellAmount: { flex: 1.5, fontSize: 9, fontFamily: "Helvetica-Bold", color: BLACK, textAlign: "right" },

  // Totals box
  totalsWrapper: { flexDirection: "row", justifyContent: "flex-end", marginTop: 6, paddingHorizontal: 40 },
  totalsBox: { width: 240 },
  totalsDivider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginVertical: 6 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: GRAY },
  totalsValue: { fontSize: 9, color: BLACK },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: NAVY, borderRadius: 3, paddingVertical: 8, paddingHorizontal: 10, marginTop: 4 },
  grandTotalLabel: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  grandTotalValue: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },

  // Notes
  notesBox: { marginHorizontal: 40, marginTop: 24, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 12 },
  notesTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: NAVY_LIGHT, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  notesText: { fontSize: 8, color: GRAY, lineHeight: 1.5 },

  // Footer
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: NAVY, paddingVertical: 12, paddingHorizontal: 40, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: "#93c5fd" },
});

export interface InvoiceDocumentProps {
  hcpFullName: string;
  hcpNpi: string;
  hcpSpecialty: string | null;
  engagementType: string;
  proposedDate: string;
  agreedRateUsd: number;
  rateUnit: string;
  noOfActivities: number | null;
  totalUsd: number;
  invoiceNumber: string;
  invoiceDate: string;
}

function fmt(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dueDateFromInvoice(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const rateUnitLabel = titleCase(props.rateUnit);
  const isPerUnit = props.rateUnit === "per_hour" || props.rateUnit === "per_day";
  const qty = isPerUnit ? (props.noOfActivities ?? 1) : 1;
  const engagementTypeLabel = titleCase(props.engagementType);

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── Header band ── */}
        <View style={styles.header}>
          <Text style={styles.companyName}>Meridian Pharma, Inc.</Text>
          <Text style={styles.companyTagline}>Medical Affairs &amp; Commercial Compliance</Text>
          <Text style={styles.companyAddress}>
            500 Life Sciences Blvd, Suite 300  ·  Bridgewater, NJ 08807  ·  Tel: (908) 555-0100  ·  compliance@meridianpharma.com
          </Text>
        </View>

        {/* ── Invoice title + meta ── */}
        <View style={styles.metaRow}>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceSubtitle}>HCP Engagement Services</Text>
          </View>
          <View style={styles.metaTable}>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Invoice #</Text>
              <Text style={styles.metaValue}>{props.invoiceNumber}</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Invoice Date</Text>
              <Text style={styles.metaValue}>{props.invoiceDate}</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Due Date</Text>
              <Text style={styles.metaValue}>{dueDateFromInvoice(props.invoiceDate)}</Text>
            </View>
            <View style={styles.metaLine}>
              <Text style={styles.metaLabel}>Payment Terms</Text>
              <Text style={styles.metaValue}>Net 30</Text>
            </View>
          </View>
        </View>

        {/* ── Bill To ── */}
        <View style={styles.sectionPad}>
          <Text style={styles.sectionTitle}>Bill To</Text>
          <View style={styles.billToCard}>
            <Text style={styles.billToName}>{props.hcpFullName}</Text>
            <Text style={styles.billToDetail}>NPI: {props.hcpNpi}</Text>
            {props.hcpSpecialty && (
              <Text style={styles.billToDetail}>Specialty: {props.hcpSpecialty}</Text>
            )}
          </View>

          {/* ── Services table ── */}
          <Text style={styles.sectionTitle}>Services Rendered</Text>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Description</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: "right" }]}>Rate</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.5, textAlign: "right" }]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.cellDesc}>
              {engagementTypeLabel}{"\n"}
              <Text style={{ fontSize: 8, color: GRAY }}>
                Engagement date: {props.proposedDate}
              </Text>
            </Text>
            <Text style={styles.cellRate}>
              {fmt(props.agreedRateUsd)}{"\n"}
              <Text style={{ fontSize: 8, color: GRAY }}>{rateUnitLabel}</Text>
            </Text>
            <Text style={styles.cellQty}>{qty}</Text>
            <Text style={styles.cellAmount}>{fmt(props.totalUsd)}</Text>
          </View>
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsWrapper}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmt(props.totalUsd)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>$0.00</Text>
            </View>
            <View style={styles.totalsDivider} />
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL DUE</Text>
              <Text style={styles.grandTotalValue}>{fmt(props.totalUsd)}</Text>
            </View>
          </View>
        </View>

        {/* ── Payment notes ── */}
        <View style={styles.notesBox}>
          <Text style={styles.notesTitle}>Payment Instructions</Text>
          <Text style={styles.notesText}>
            Please remit payment within 30 days of invoice date via ACH transfer or check payable to Meridian Pharma, Inc.{"\n"}
            ACH: Routing 021000021  ·  Account 4400112233  ·  Reference: {props.invoiceNumber}{"\n"}
            Questions: accounts.payable@meridianpharma.com  ·  (908) 555-0199
          </Text>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Meridian Pharma, Inc.  ·  FEIN: 22-3456789  ·  Registered in the State of New Jersey</Text>
        </View>

      </Page>
    </Document>
  );
}
