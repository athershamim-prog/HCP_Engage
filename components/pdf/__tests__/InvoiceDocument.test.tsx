/**
 * @jest-environment jsdom
 */
/**
 * Tests for components/pdf/InvoiceDocument.tsx
 * Requirements: CONT-02
 * Wave 0 — these tests FAIL until InvoiceDocument.tsx and @react-pdf/renderer are in place.
 *
 * Strategy: renderToBuffer produces a Buffer. We check the string representation
 * contains the text values passed as props (react-pdf embeds text in PDF content stream).
 * For unit test purposes we use renderToStream and collect to string, OR use
 * a simple existence check that the component renders without throwing.
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
    expect(getByText("1234567890")).toBeTruthy();
  });
  it("renders total compensation", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText("$700.00")).toBeTruthy();
  });
  it("renders No of Activities when noOfActivities is set", () => {
    const { getByText } = render(<InvoiceDocument {...BASE_PROPS} />);
    expect(getByText("2")).toBeTruthy();
  });
  it("does not render No of Activities section when noOfActivities is null", () => {
    const { queryByText } = render(<InvoiceDocument {...BASE_PROPS} noOfActivities={null} />);
    // "No of Activities" label should not appear
    expect(queryByText("No of Activities")).toBeNull();
  });
});
