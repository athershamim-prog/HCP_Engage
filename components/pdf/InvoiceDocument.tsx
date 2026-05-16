// NO "use client" — this file runs in Node.js via renderToBuffer ONLY.
// DO NOT add "use client" — doing so causes "PDFDocument is not a constructor" errors.
// Pattern: props-in / render-out, like components/fmv/FmvRatePanel.tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 16 },
  label: { fontSize: 9, color: "#666", marginBottom: 2 },
  value: { fontSize: 12, marginBottom: 10 },
  row: { flexDirection: "row", gap: 16 },
  col: { flex: 1 },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ddd", marginVertical: 12 },
  total: { fontSize: 14, fontWeight: "bold" },
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
}

export function InvoiceDocument(props: InvoiceDocumentProps) {
  const showActivities = props.noOfActivities !== null && props.noOfActivities !== undefined;
  const rateUnitLabel = props.rateUnit.replace(/_/g, " ");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>HCP Engagement Invoice</Text>
        <View style={styles.divider} />

        {/* HCP Section */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>HCP Name</Text>
            <Text style={styles.value}>{props.hcpFullName}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>NPI</Text>
            <Text style={styles.value}>{props.hcpNpi}</Text>
          </View>
        </View>
        <Text style={styles.label}>Specialty</Text>
        <Text style={styles.value}>{props.hcpSpecialty ?? "—"}</Text>

        <View style={styles.divider} />

        {/* Engagement Section */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Engagement Type</Text>
            <Text style={styles.value}>{props.engagementType.replace(/_/g, " ")}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Proposed Date</Text>
            <Text style={styles.value}>{props.proposedDate}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Financials Section */}
        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Agreed Rate</Text>
            <Text style={styles.value}>
              ${props.agreedRateUsd.toFixed(2)} {rateUnitLabel}
            </Text>
          </View>
          {showActivities && (
            <View style={styles.col}>
              <Text style={styles.label}>No of Activities</Text>
              <Text style={styles.value}>{props.noOfActivities}</Text>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        <Text style={styles.label}>Total Compensation</Text>
        <Text style={styles.total}>${props.totalUsd.toFixed(2)}</Text>
      </Page>
    </Document>
  );
}
