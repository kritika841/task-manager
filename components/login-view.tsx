"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Sparkles } from "lucide-react";
import { Button } from "./ui/button";

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Please enter both email address and password.");
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await onLogin(email.trim(), password);
      if (!result.success) {
        setErrorMessage(result.error || "Invalid credentials. Please verify your email and password.");
      }
    } catch (err: any) {
      setErrorMessage(err?.message || "An unexpected error occurred during sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4 sm:p-6 antialiased selection:bg-primary/20">
      <div className="w-full max-w-md">
        {/* Top Brand Logo */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="relative h-12 w-36 mb-3">
            <Image
              src="/logo-light.png"
              alt="Satmi"
              fill
              className="object-contain dark:hidden"
              priority
            />
            <Image
              src="/logo-dark.png"
              alt="Satmi"
              fill
              className="object-contain hidden dark:block"
              priority
            />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 shadow-2xs">
            <Sparkles className="size-3 text-primary" />
            <span>Task Manager & Deliverables</span>
          </span>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-float backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
          <div className="mb-6">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Sign In to Your Workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Log in with your official AdFlow email and password to access your daily quotas and assigned tasks.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-xl border border-destructive/25 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Work Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Mail className="size-4" />
                </div>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="name@satmi.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/20 pl-9 pr-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="size-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-border bg-muted/20 pl-9 pr-10 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={isLoading}
              className="w-full h-10 mt-2 text-xs font-semibold gap-2 shadow-sm cursor-pointer"
            >
              {isLoading ? (
                <span>Verifying credentials...</span>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Team Sign-In (1-Click Access) */}
          <div className="mt-5 pt-4 border-t border-border">
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 text-center">
              Quick Workspace Access
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: "Kritika", email: "kritika@satmi.in", role: "Admin", code: "KRI", color: "#14b8a6" },
                { name: "Ishika", email: "ishika@satmi.in", role: "Manager", code: "ISH", color: "#6366f1" },
                { name: "Kunal", email: "kunal@satmi.in", role: "Editor", code: "KUN", color: "#0ea5e9" },
                { name: "Nikhil", email: "nikhil@satmi.in", role: "Editor", code: "NIK", color: "#10b981" },
                { name: "Himik", email: "himik@satmi.in", role: "Creator", code: "HIM", color: "#f59e0b" },
                { name: "Priya", email: "priya@satmi.in", role: "Creator", code: "PRI", color: "#ec4899" },
              ].map((member) => (
                <button
                  key={member.email}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onLogin(member.email, "workspace-auth-pass")}
                  className="flex items-center gap-2 p-1.5 rounded-lg border border-border/80 bg-muted/20 hover:bg-muted/60 hover:border-primary/40 transition text-left cursor-pointer group"
                >
                  <div
                    className="size-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ring-1"
                    style={{
                      backgroundColor: `${member.color}20`,
                      color: member.color,
                      borderColor: `${member.color}40`,
                    }}
                  >
                    {member.code.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {member.name}
                    </div>
                    <div className="text-[9px] text-muted-foreground truncate">
                      {member.role}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Security footnote */}
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-primary" />
            <span>AdFlow Unified Authentication Protected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
