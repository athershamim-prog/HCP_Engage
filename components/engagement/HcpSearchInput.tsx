"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface HcpResult {
  id: string;
  fullName: string;
  npi: string;
  nuccDisplayName: string;
  primaryState: string;
  status: string;
}

interface HcpSearchInputProps {
  onSelect: (hcp: HcpResult) => void;
  selectedHcp?: HcpResult | null;
  onClear: () => void;
}

export function HcpSearchInput({ onSelect, selectedHcp, onClear }: HcpSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HcpResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [arrowSelectedIndex, setArrowSelectedIndex] = useState(-1);
  // debounce — 300ms timeout ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hcps/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results ?? []);
        setIsOpen(true);
        setArrowSelectedIndex(-1);
      } catch {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close popover on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(hcp: HcpResult) {
    onSelect(hcp);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setArrowSelectedIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setArrowSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setArrowSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && arrowSelectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[arrowSelectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  // If HCP is selected, show pill with clear button
  if (selectedHcp) {
    return (
      <div className="flex items-center gap-2 h-11 px-3 rounded-lg border border-input bg-[hsl(0_0%_98%)]">
        <span className="text-[14px] font-medium flex-1">{selectedHcp.fullName}</span>
        <span className="text-[12px] text-[hsl(215_16%_47%)]">{selectedHcp.npi}</span>
        <button
          type="button"
          onClick={onClear}
          className="text-[hsl(215_16%_47%)] hover:text-[hsl(220_13%_18%)] transition-colors"
          aria-label={`Remove ${selectedHcp.fullName} selection`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        role="combobox"
        aria-expanded={isOpen}
        aria-activedescendant={
          arrowSelectedIndex >= 0 ? `hcp-option-${arrowSelectedIndex}` : undefined
        }
        aria-autocomplete="list"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search by name or NPI..."
        className="h-11"
      />
      {isOpen && (
        <div
          role="listbox"
          aria-label="HCP search results"
          className={cn(
            "absolute z-50 w-full mt-1 rounded-lg border border-input bg-white shadow-md max-h-64 overflow-y-auto"
          )}
        >
          {results.length === 0 ? (
            <div className="px-3 py-4 text-[14px] text-[hsl(215_16%_47%)]">
              No HCPs found for &quot;{query}&quot;. Try a different name or NPI.
            </div>
          ) : (
            results.map((hcp, i) => (
              <div
                key={hcp.id}
                id={`hcp-option-${i}`}
                role="option"
                aria-selected={i === arrowSelectedIndex}
                className={cn(
                  "px-3 py-2.5 cursor-pointer text-[14px] hover:bg-[hsl(220_14%_96%)] transition-colors",
                  i === arrowSelectedIndex && "bg-[hsl(220_14%_96%)]"
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(hcp);
                }}
              >
                <span className="font-medium">{hcp.fullName}</span>
                <span className="text-[hsl(215_16%_47%)]"> — {hcp.npi} </span>
                <span className="text-[12px] text-[hsl(215_16%_47%)]">({hcp.nuccDisplayName})</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
