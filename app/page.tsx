"use client";

import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";

export default function Home() {
  const router = useRouter();

  const goToRedeem = () => {
    router.push("/redeem");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
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
                LFC Jahi Media Archive
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Living Faith Church Jahi • Exclusive content access
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - centered button */}
      <main className="flex flex-col items-center justify-center min-h-[80vh] px-4">
        <div className="max-w-md w-full text-center">
          {/* Icon/visual element */}
          <div className="mb-8 flex justify-center">
            <div className="p-6 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-full border border-white/10">
              <Ticket className="w-16 h-16 text-blue-400" />
            </div>
          </div>
          
          {/* Title */}
          <h2 className="text-3xl font-bold mb-4">
            Access Your Media
          </h2>
          
          {/* Description */}
          <p className="text-gray-400 mb-10 max-w-sm mx-auto">
            Enter your coupon code to unlock exclusive images, videos, and audio content.
          </p>
          
          {/* Redeem button */}
          <button
            onClick={goToRedeem}
            className="w-full max-w-xs mx-auto py-4 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20"
          >
            <Ticket className="w-5 h-5" />
            Redeem Coupon
          </button>
          
          {/* Optional: Small instructions */}
          <div className="mt-12 pt-8 border-t border-white/10">
            <p className="text-sm text-gray-500">
              Need a coupon? Contact support for access.
            </p>
          </div>
        </div>
      </main>

      {/* Simple footer */}
      <footer className="border-t border-white/10 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} LFC Jahi Media Archive • All rights reserved</p>
        </div>
      </footer>
    </div>
  );
}