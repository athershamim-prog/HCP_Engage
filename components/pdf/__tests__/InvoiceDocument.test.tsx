/**
 * @jest-environment jsdom
 */

// Mock @react-pdf/renderer for unit tests (avoids binary PDF dependency in CI)
jest.mock("@react-pdf/renderer", () => ({
  Document: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Page: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  StyleSheet: { create: (s: unknown) => s },
}));

import React from "react";
import { render } from "@testing-library/react";
import { InvoiceDocument } from "@/components/pdf/InvoiceDocument";

const BASE_PROPS = {
  hcpFullName: "Dr. Jane Smith",
  hcpNpi: "1234567890",
  hcpSpecialty: "Internal Medicine",
  engagementType: "advisory_board",
  proposedDate: "2026-06-01",
  agreedRateUsd: 350,
  rateUnit: "per_hour",
  noOfActivities: 2,
  totalUsd: 700,
  invoiceNumber: "INV-ABC12345",
  invoiceDate: "2026-05-20",
};

describe("InvoiceDocument", () => {
  it("renders without throwing", () => {
    expect(() => render(<InvoiceDocument {...BASE_PROPS} />)).not.toThrow();
  });

  it("renders HCP full name", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText("Dr. Jane Smith")).toBeTruthy();
  });

  it("renders HCP NPI", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText(/1234567890/)).toBeTruthy();
  });

  it("renders invoice number", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText("INV-ABC12345")).toBeTruthy();
  });

  it("renders total amount at least once", () => {
    const { getAllByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    // Total appears in services row, subtotal, and grand total
    expect(getAllByText("$700.00").length).toBeGreaterThanOrEqual(1);
  });

  it("renders quantity for per_hour engagement", () => {
    const { getAllByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getAllByText("2").length).toBeGreaterThanOrEqual(1);
  });

  it("renders qty as 1 for flat_fee when noOfActivities is null", () => {
    const { getAllByText } = render(
      <InvoiceDocument {...BASE_PROPS} rateUnit="flat_fee" noOfActivities={null} totalUsd={350} />
    );
    expect(getAllByText("1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders company header", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText("Meridian Pharma, Inc.")).toBeTruthy();
  });
});
