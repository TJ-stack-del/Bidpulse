"use client";

import { useState } from "react";

export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-2">
      {faqs.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.q} className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-4 px-gutter py-4 text-left"
            >
              <span className="text-title-lg text-primary">{item.q}</span>
              <span className="material-symbols-outlined text-on-surface-variant shrink-0">
                {isOpen ? "remove" : "add"}
              </span>
            </button>
            {isOpen && <p className="text-body-md text-on-surface-variant px-gutter pb-4">{item.a}</p>}
          </div>
        );
      })}
    </div>
  );
}
