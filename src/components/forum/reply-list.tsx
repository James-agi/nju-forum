"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { PostContent } from "@/components/forum/post-content";
import { ReplyForm } from "./reply-form";

interface Reply {
  id: string;
  content: string;
  images: string[];
  createdAt: Date;
  author: {
    id: string;
    name: string;
    avatar: string | null;
  };
  children?: Reply[];
}

interface ReplyListProps {
  replies: Reply[];
  postId: string;
  depth?: number;
  canReply?: boolean;
}

function ReplyItem({
  reply,
  postId,
  depth = 0,
  canReply = true,
}: {
  reply: Reply;
  postId: string;
  depth: number;
  canReply?: boolean;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className={depth > 0 ? "ml-4 border-l-2 border-muted pl-3 sm:ml-8 sm:pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={reply.author.avatar ?? undefined} alt={reply.author.name} />
          <AvatarFallback className="text-xs">
            {reply.author.name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">{reply.author.name}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(reply.createdAt).toLocaleString("zh-CN")}
            </span>
          </div>
          <PostContent content={reply.content} images={reply.images} className="text-sm" />
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-6 px-2 text-xs"
            onClick={() => setShowReplyForm(!showReplyForm)}
          >
            <MessageSquare className="mr-1 h-3 w-3" />
            回复
          </Button>
          {showReplyForm && (
            <div className="mt-2">
              <ReplyForm
                postId={postId}
                parentId={reply.id}
                canReply={canReply}
                onCancel={() => setShowReplyForm(false)}
                placeholder={`回复 ${reply.author.name}...`}
              />
            </div>
          )}
        </div>
      </div>
      {reply.children?.map((child) => (
        <ReplyItem
          key={child.id}
          reply={child}
          postId={postId}
          depth={depth + 1}
          canReply={canReply}
        />
      ))}
    </div>
  );
}

export function ReplyList({ replies, postId, canReply = true }: ReplyListProps) {
  if (replies.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          暂无回复，快来抢沙发吧！
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="divide-y">
      {replies.map((reply) => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          postId={postId}
          depth={0}
          canReply={canReply}
        />
      ))}
    </div>
  );
}
