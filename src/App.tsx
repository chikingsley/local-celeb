import { useState } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center mb-8">Welcome to Tauri + React</h1>

        <div className="flex justify-center gap-4 mb-8">
          <a href="https://vitejs.dev" target="_blank" className="block hover:opacity-80 transition-opacity">
            <img src="/vite.svg" className="h-24 p-6" alt="Vite logo" />
          </a>
          <a href="https://tauri.app" target="_blank" className="block hover:opacity-80 transition-opacity">
            <img src="/tauri.svg" className="h-24 p-6" alt="Tauri logo" />
          </a>
          <a href="https://reactjs.org" target="_blank" className="block hover:opacity-80 transition-opacity">
            <img src={reactLogo} className="h-24 p-6" alt="React logo" />
          </a>
        </div>
        
        <p className="text-center text-muted-foreground mb-8">
          Click on the Tauri, Vite, and React logos to learn more.
        </p>

        <form
          className="flex gap-2 max-w-md mx-auto"
          onSubmit={(e) => {
            e.preventDefault();
            greet();
          }}
        >
          <input
            id="greet-input"
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Enter a name..."
            className="flex-1 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button type="submit">
            Greet
          </Button>
        </form>
        
        {greetMsg && (
          <p className="text-center mt-4 p-4 bg-card border border-border rounded-md">
            {greetMsg}
          </p>
        )}
      </div>
    </main>
  );
}

export default App;
