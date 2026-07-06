import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Library = {
  id: string;
  slug: string;
  name: string;
  name_ml: string | null;
  location: string | null;
  is_default: boolean;
};

const STORAGE_KEY = "bookary.library_id";

async function fetchLibraries(): Promise<Library[]> {
  const { data, error } = await supabase
    .from("libraries")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as Library[];
}

type Ctx = {
  libraries: Library[];
  selected: Library | null;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
};

const LibraryContext = createContext<Ctx | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data: libraries = [] } = useQuery({
    queryKey: ["libraries"],
    queryFn: fetchLibraries,
    staleTime: 1000 * 60 * 10,
  });

  const [selectedId, setSelectedIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  // Default to is_default library if nothing chosen
  useEffect(() => {
    if (selectedId || libraries.length === 0) return;
    const def = libraries.find((l) => l.is_default) ?? libraries[0];
    if (def) {
      setSelectedIdState(def.id);
      window.localStorage.setItem(STORAGE_KEY, def.id);
    }
  }, [libraries, selectedId]);

  const setSelectedId = (id: string) => {
    setSelectedIdState(id);
    window.localStorage.setItem(STORAGE_KEY, id);
    qc.invalidateQueries({ queryKey: ["books"] });
    qc.invalidateQueries({ queryKey: ["home-data"] });
    qc.invalidateQueries({ queryKey: ["books-page"] });
    qc.invalidateQueries({ queryKey: ["new-arrivals"] });
    qc.invalidateQueries({ queryKey: ["genre-facets"] });
  };

  const selected = libraries.find((l) => l.id === selectedId) ?? null;

  return (
    <LibraryContext.Provider value={{ libraries, selected, selectedId, setSelectedId }}>
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

// Read selected library id outside React (used by query fetchers).
export function getSelectedLibraryId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
