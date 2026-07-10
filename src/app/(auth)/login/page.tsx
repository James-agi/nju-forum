"use client";

import { useState, useEffect, useRef } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotionQuery.matches) return;

    let animId = 0;
    let isVisible = !document.hidden;
    const particles: { x: number; y: number; vx: number; vy: number; size: number; alpha: number }[] = [];

    const isDark = () => document.documentElement.classList.contains("dark");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const count = window.innerWidth < 768 ? 36 : 80;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.5 + 0.3,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const dark = isDark();

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > window.innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > window.innerHeight) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? `rgba(135,220,205,${p.alpha * 0.42})`
          : `rgba(0,0,0,${p.alpha * 0.6})`;
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const lineAlpha = 0.15 * (1 - dist / 150);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = dark
              ? `rgba(135,220,205,${lineAlpha * 0.65})`
              : `rgba(0,0,0,${lineAlpha * 0.5})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      if (isVisible) {
        animId = requestAnimationFrame(draw);
      }
    };

    const start = () => {
      if (!animId && isVisible) {
        animId = requestAnimationFrame(draw);
      }
    };

    const stop = () => {
      if (animId) {
        cancelAnimationFrame(animId);
        animId = 0;
      }
    };

    const handleVisibilityChange = () => {
      isVisible = !document.hidden;
      if (isVisible) {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 z-0" />;
}

function getSafeCallbackUrl() {
  const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!callbackUrl || !callbackUrl.startsWith("/") || callbackUrl.startsWith("//")) {
    return "/forum";
  }
  return callbackUrl;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    setJustRegistered(new URLSearchParams(window.location.search).get("registered") === "true");
  }, []);

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      });
      if (result?.error) {
        setError("邮箱或密码错误，或账号已被封禁");
      } else {
        window.location.href = getSafeCallbackUrl();
      }
    } catch {
      setError("登录失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await doLogin(email, password);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white dark:bg-background">
      <ParticleBackground />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-transparent to-white/60 dark:to-background/70" />
      <Card className="relative z-10 w-full max-w-md border-border/50 bg-background/80 backdrop-blur-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center border border-border bg-secondary">
            <BookOpen className="h-6 w-6 text-foreground" />
          </div>
          <CardTitle className="text-2xl">登录知南</CardTitle>
          <CardDescription>使用注册邮箱登录</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {justRegistered && !error && (
              <div className="rounded-md bg-primary/10 p-3 text-sm text-primary">
                注册成功！请使用刚注册的账号登录
              </div>
            )}
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登录中..." : "登录"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              还没有账号？{" "}
              <Link href="/register" className="text-primary hover:underline">
                立即注册
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
