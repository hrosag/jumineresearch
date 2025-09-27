"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";

const Excalidraw = dynamic<any>(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function WhiteboardSandbox() {
  const [scene, setScene] = useState<any>(null);

  async function saveScene() {
    if (!scene) return;
    const { error } = await supabase.from("whiteboards").insert({
      name: "Minha Lousa",
      data: scene,
    });
    if (error) console.error(error);
    else alert("Lousa salva!");
  }

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        initialData={{ elements: [], appState: { theme: "light" } }}
        onChange={(elements: any, appState: any, files: any) =>
          setScene({ elements, appState, files })
        }
      />
      <button
        onClick={saveScene}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "black",
          color: "white",
          padding: "8px 12px",
          borderRadius: "6px",
        }}
      >
        Salvar no Supabase
      </button>
    </div>
  );
}
