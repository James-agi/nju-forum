"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

interface FavoriteButtonProps {
  postId: string;
  initialFavorited: boolean;
  canFavorite?: boolean;
}

export function FavoriteButton({
  postId,
  initialFavorited,
  canFavorite = true,
}: FavoriteButtonProps) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async () => {
    if (!canFavorite) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
        router.refresh();
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!canFavorite) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link href="/login">
          <Heart className="mr-2 h-4 w-4" />
          登录后收藏
        </Link>
      </Button>
    );
  }

  return (
    <Button
      variant={favorited ? "default" : "outline"}
      size="sm"
      onClick={toggleFavorite}
      disabled={loading}
    >
      <Heart className={`mr-2 h-4 w-4 ${favorited ? "fill-current" : ""}`} />
      {favorited ? "已收藏" : "收藏"}
    </Button>
  );
}
