import { searchHcps } from "@/actions/hcp";
import { HcpTable } from "@/components/hcp/HcpTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";

export const metadata = { title: "HCP Directory — HCP Engage" };

export default async function HcpsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const page = parseInt(params.page ?? "1", 10);

  const { hcps, total } = await searchHcps({
    query,
    page,
    pageSize: 20,
  });

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[20px] font-semibold text-[hsl(220_13%_18%)]">HCP Directory</h1>
        <Link
          href="/hcps/new"
          className="inline-flex items-center justify-center rounded-lg bg-[hsl(221_83%_53%)] hover:bg-[hsl(221_83%_47%)] h-11 px-4 text-sm font-medium text-white transition-colors"
        >
          Add HCP
        </Link>
      </div>

      {/* Search bar — client-side form submission via GET */}
      <form method="GET" className="flex gap-3 mb-6">
        <Input
          name="q"
          defaultValue={query}
          placeholder="Search by name or NPI..."
          className="w-[320px] h-11"
          aria-label="Search HCPs"
        />
        <Button type="submit" variant="outline" className="h-11">Search</Button>
        {query && (
          <Link
            href="/hcps"
            className="inline-flex items-center justify-center rounded-lg h-11 px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Clear
          </Link>
        )}
      </form>

      <HcpTable hcps={hcps} emptyQuery={query || undefined} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/hcps?q=${encodeURIComponent(query)}&page=${p}`}
              className={`inline-flex items-center justify-center rounded-lg h-9 w-9 text-sm font-medium transition-colors ${
                p === page
                  ? "bg-[hsl(221_83%_53%)] text-white"
                  : "border border-border bg-background hover:bg-muted"
              }`}
              aria-label={`Page ${p}`}
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
