// app/admin/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState("");
  const router = useRouter();

  const login = async () => {
    setError("");
    setDebug("");
    setLoading(true);

    try {
      console.log("Attempting login with password length:", password.length);
      
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      console.log("Response:", { status: res.status, data });
      
      if (!res.ok) {
        setError(data.error || `Login failed (${res.status})`);
        setDebug(JSON.stringify(data, null, 2));
        return;
      }

      // Success - redirect to admin dashboard
      router.push("/admin");
      router.refresh(); // Important: refresh to apply middleware
      
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      login();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-black text-white">
      <div className="w-full max-w-md border border-gray-700 p-8 rounded-xl bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="bg-white p-2 rounded-full">
            <img 
              src="/logo.png" 
              alt="LFC Jahi Logo" 
              className="w-12 h-12"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-center">LFC Jahi Admin</h1>
            <p className="text-gray-400 text-center">Secure Access Required</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter admin password"
              className="w-full p-3 bg-black/50 border border-gray-700 rounded-lg outline-none focus:border-blue-500 transition"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
          </div>

          <button
            onClick={login}
            disabled={loading || !password}
            className="w-full p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                Verifying...
              </span>
            ) : (
              "Authenticate"
            )}
          </button>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 font-medium">Authentication Failed</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          )}

          {debug && (
            <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <p className="text-sm text-gray-400 mb-2">Debug Info:</p>
              <pre className="text-xs text-gray-300 overflow-auto">{debug}</pre>
            </div>
          )}

          <div className="text-center text-sm text-gray-500 mt-6">
            <p>Contact support if you've lost admin credentials</p>
          </div>
        </div>
      </div>
    </div>
  );
}