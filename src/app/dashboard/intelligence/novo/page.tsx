// This page uses dynamic server data
export const instant = false;

import { connection } from "next/server";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ChatInterface } from "../_components/chat-interface";
import { createConversation, getAiStatus } from "../actions";

export default async function NovaConversaPage(props: {
 searchParams: Promise<{ q?: string }>;
}) {
  // Opt out of static prerendering — required when cacheComponents: true
 await connection();
 const params = await props.searchParams;
 const initialQuestion = params.q ?? undefined;

 const status = await getAiStatus();

 if (!status || status.needs_setup) {
 return (
 <div className="space-y-6">
 <Link
 href="/dashboard/intelligence"
 className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
 >
 <ArrowLeft className="h-4 w-4" />
 Voltar
 </Link>
 <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
 <p className="text-sm text-amber-800">
 Barber-On Intelligence não está configurado. Configure a variável ANTHROPIC_API_KEY no servidor.
 </p>
 </div>
 </div>
 );
 }

 // Create a new conversation for this session
 const conversation = await createConversation(
 initialQuestion ? initialQuestion.slice(0, 60) : undefined,
 );

 return (
 <div className="space-y-4">
 {/* Header */}
 <div className="flex items-center gap-3">
 <Link
 href="/dashboard/intelligence"
 className="inline-flex items-center gap-1.5 text-sm font-medium text-barber-muted transition-colors hover:text-barber-gold"
 >
 <ArrowLeft className="h-4 w-4" />
 Voltar
 </Link>
 <div className="flex items-center gap-2">
 <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-barber-gold to-barber-cyan">
 <Sparkles className="h-3.5 w-3.5 text-white" />
 </div>
 <h1 className="font-display text-lg font-bold text-barber-white">Nova conversa</h1>
 </div>
 </div>

 {/* Chat Interface */}
 <ChatInterface
 conversationId={conversation.id}
 initialQuestion={initialQuestion}
 />
 </div>
 );
}