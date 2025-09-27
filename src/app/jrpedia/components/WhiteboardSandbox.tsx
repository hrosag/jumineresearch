"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@supabase/supabase-js";
import type {
  ExcalidrawElement,
  AppState,
  BinaryFileData,
  ExcalidrawAPI,
} from "@excalidraw/excalidraw";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type SceneData = {
  elements?: ExcalidrawElement[];
  appState?: AppState;
  files?: Record<string, BinaryFileData>;
};

export default function WhiteboardSandbox() {
  const [scene, setScene] = useState<SceneData | null>(null);
  const [initialData, setInitialData] = useState<SceneData | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const excalidrawRef = useRef<ExcalidrawAPI | null>(null);

  // Carregar a lousa salva no Supabase ao abrir
  useEffect(() => {
    async function loadScene() {
      const { data, error } = await supabase
        .from("whiteboards")
        .select("data")
        .eq("id", "main")
        .single();

      if (!error && data?.data) {
        setInitialData(data.data as SceneData);
        setScene(data.data as SceneData);
      }
    }
    loadScene();
  }, []);

  // Salvar sobrescrevendo sempre o mesmo registro
  async function saveScene() {
    if (!scene) return;
    const { error } = await supabase.from("whiteboards").upsert({
      id: "main",
      name: "Lousa Única",
      data: scene,
    });
    if (error) console.error(error);
    else alert("Lousa salva!");
  }

  // Pedir senha do DBAdmin
  function requestAdmin() {
    const pwd = prompt("Digite a senha do DBAdmin:");
    if (pwd === process.env.NEXT_PUBLIC_DBADMIN_PWD) {
      setIsAdmin(true);
      alert("Modo edição ativado.");
    } else {
      alert("Senha incorreta.");
    }
  }

  // Exportar área delimitada pelo retângulo de seleção
  function exportArea() {
    const currentScene = scene;
    const selectionElement = currentScene?.appState?.selectionElement;

    if (!selectionElement || !currentScene || !currentScene.appState) {
      alert("Nenhuma área de seleção desenhada.");
      return;
    }

    const { x, y, width = 0, height = 0 } = selectionElement;

    const elementsInBox = (currentScene.elements ?? []).filter((element) => {
      const elRight = element.x + (element.width ?? 0);
      const elBottom = element.y + (element.height ?? 0);
      return (
        element.x >= x &&
        element.y >= y &&
        elRight <= x + width &&
        elBottom <= y + height
      );
    });

    if (elementsInBox.length === 0) {
      alert("Nenhum elemento dentro da área selecionada.");
      return;
    }

    const data: SceneData = {
      elements: elementsInBox,
      appState: currentScene.appState,
      files: currentScene.files ?? {},
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "excalidraw-area.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ height: "100vh" }}>
      <Excalidraw
        ref={excalidrawRef}
        viewModeEnabled={!isAdmin}
        initialData={
          initialData ?? {
            elements: [],
            appState: { theme: "light", viewModeEnabled: !isAdmin },
          }
        }
        onChange={(
          elements: ExcalidrawElement[],
          appState: AppState,
          files: Record<string, BinaryFileData>
        ) => {
          const nextScene: SceneData = {
            elements,
            appState,
            files,
          };

          setScene(nextScene);
        }}
      />
      {!isAdmin && (
        <button
          onClick={requestAdmin}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "gray",
            color: "white",
            padding: "8px 12px",
            borderRadius: "6px",
          }}
        >
          Entrar como DBAdmin
        </button>
      )}
      {isAdmin && (
        <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: "8px" }}>
          <button
            onClick={saveScene}
            style={{
              background: "black",
              color: "white",
              padding: "8px 12px",
              borderRadius: "6px",
            }}
          >
            Salvar no Supabase
          </button>
          <button
            onClick={exportArea}
            style={{
              background: "blue",
              color: "white",
              padding: "8px 12px",
              borderRadius: "6px",
            }}
          >
            Exportar Área
          </button>
        </div>
      )}
    </div>
  );
}
