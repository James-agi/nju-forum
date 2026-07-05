"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";
import { PostContent } from "@/components/forum/post-content";
import { ReplyForm } from "./reply-form";

interface Reply {
  id: string;
  content: string;
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
}

function ReplyItem({ reply, postId, depth = 0 }: { reply: Reply; postId: string; depth: number }) {
  const [showReplyForm, setShowReplyForm] = useState(false);

  return (
    <div className={depth > 0 ? "ml-8 border-l-2 border-muted pl-4" : ""}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 shrink-0">
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
          <PostContent content={reply.content} className="text-sm" />
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
                onCancel={() => setShowReplyForm(false)}
                placeholder={`回复 ${reply.author.name}...`}
              />
            </div>
          )}
        </div>
      </div>
      {reply.children?.map((child) => (
        <ReplyItem key={child.id} reply={child} postId={postId} depth={depth + 1} />
      ))}
    </div>
  );
}

export function ReplyList({ replies, postId }: ReplyListProps) {
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
        <ReplyItem key={reply.id} reply={reply} postId={postId} depth={0} />
      ))}
    </div>
  );
}
