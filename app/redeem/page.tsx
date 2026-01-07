"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, ArrowRight, Key, Clock, AlertCircle } from "lucide-react";

export default function RedeemPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const redeem = async () => {
    if (!code) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/coupons/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "Coupon already redeemed") {
          setError("This coupon has already been used.");
        } else if (data.error === "Coupon expired") {
          setError("This coupon has expired.");
        } else if (data.error === "Invalid coupon") {
          setError("Invalid coupon code. Please check and try again.");
        } else {
          setError(data.error || "Failed to redeem coupon.");
        }
        setLoading(false);
        return;
      }

      localStorage.setItem("coupon_access", data.accessToken);
      router.push("/media");

    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      redeem();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-white/10 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="bg-white p-2 rounded-full">
              <img 
                src="/logo.png" 
                alt="LFC Jahi Logo" 
                className="w-12 h-12"
              />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                LFC Jahi Media Access
              </h1>
              <p className="text-gray-400 text-sm">
                Enter your unique coupon code to unlock media
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex items-center justify-center min-h-[80vh] px-4">
        <div className="w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8 shadow-2xl">
            {/* Form Title */}
            <div className="text-center mb-8">
              <div className="inline-flex p-3 bg-blue-500/10 rounded-full mb-4">
                <Key className="w-8 h-8 text-blue-400" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Enter Coupon Code</h2>
              <p className="text-gray-400 text-sm">
                Your access will be valid for 24 hours
              </p>
            </div>

            {/* Input Field */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Coupon Code
              </label>
              <div className="relative">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., SSTT-5MIN-ALL"
                  className="w-full p-4 pl-12 bg-black/30 border border-white/20 rounded-xl text-lg font-mono tracking-wider outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 transition"
                  disabled={loading}
                  autoFocus
                />
                <Ticket className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-500" />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                <div className="flex items-center gap-3 text-red-400">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Redeem Button */}
            <button
              onClick={redeem}
              disabled={loading || !code.trim()}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-800 disabled:cursor-not-allowed rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-3 group"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verifying...
                </>
              ) : (
                <>
                  <span>Redeem Now</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Info Section */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="space-y-3 text-sm text-gray-400">
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4" />
                  <span>Access valid for 24 hours after redemption</span>
                </div>
                <div className="flex items-center gap-3">
                  <Ticket className="w-4 h-4" />
                  <span>Each coupon can be redeemed once</span>
                </div>
                <p className="text-center mt-4 text-gray-500">
                  Need a coupon? Contact support for access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} LFC Jahi Media Archive • All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}