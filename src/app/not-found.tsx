import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="mt-3 text-3xl font-semibold text-foreground">页面未找到</h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
        这个地址不存在，或内容已经被移动。
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href="/forum">回到论坛</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/search">搜索内容</Link>
        </Button>
      </div>
    </div>
  );
}
