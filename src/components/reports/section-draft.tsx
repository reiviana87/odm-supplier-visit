"use client";

import { createContext, useContext, type ReactNode } from "react";

import type { SectionId } from "@/types/domain";

/**
 * The section body the editor is holding, and the two ways a section can change
 * it — Phase 2 §18.
 *
 * The editor shell owns the draft, not the section component: the shell is what
 * autosaves it, what knows the row's `version`, and what has to hand it to the
 * conflict dialog when a save loses a race. A section that binds its textarea to
 * its own `useState` is a draft the save path cannot see, which is exactly the
 * Phase 1 arrangement this replaces.
 *
 * One section is open at a time — each is its own route — so the context carries
 * one draft, and `useSectionDraft` refuses to hand a section anybody else's.
 */

export interface SectionDraft {
  body: string;
  /** README §25's export toggle, stored on the same row as the body. */
  excluded: boolean;
}

export interface SectionDraftValue {
  reportId: string;
  sectionId: SectionId;
  draft: SectionDraft;
  setBody: (body: string) => void;
  setExcluded: (excluded: boolean) => void;
  /**
   * False when this section has no body of its own — General Information, the
   * image sub-sections and the Appendix, whose content is rows and photographs.
   * Their editors leave the draft alone.
   */
  editable: boolean;
}

const SectionDraftContext = createContext<SectionDraftValue | null>(null);

export function SectionDraftProvider({
  value,
  children,
}: {
  value: SectionDraftValue;
  children: ReactNode;
}) {
  return (
    <SectionDraftContext.Provider value={value}>
      {children}
    </SectionDraftContext.Provider>
  );
}

/**
 * The draft for `sectionId`, or a thrown error.
 *
 * The section id is passed in and checked rather than taken on trust: a section
 * rendered under another section's provider would autosave its text into the
 * wrong row, and silently writing §3 into §1 is worse than a crash in
 * development. Both are programmer errors — the editor route renders the
 * section the URL names, inside the provider for that same id.
 */
export function useSectionDraft(sectionId: SectionId): SectionDraftValue {
  const value = useContext(SectionDraftContext);

  if (value === null) {
    throw new Error(
      `useSectionDraft("${sectionId}") was called outside the report editor.`,
    );
  }
  if (value.sectionId !== sectionId) {
    throw new Error(
      `useSectionDraft("${sectionId}") was called inside the editor for "${value.sectionId}".`,
    );
  }

  return value;
}
