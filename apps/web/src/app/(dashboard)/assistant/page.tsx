'use client';

import { useState, useEffect, useRef } from 'react';
import { useApi } from '@/lib/hooks';
import { assistantApi, type AIConversationSession, type AIMessage, type AIEvidence, type AIToolCall } from '@/lib/api/assistant';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from '@/components/ui';
import { LoadingSpinner, ErrorState, EmptyState, formatDateTime, confidenceColor } from '@/lib/utils';

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-xs font-medium text-purple-700">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
        <circle cx="12" cy="15" r="2" />
      </svg>
      AI Response
    </span>
  );
}

function DeterministicBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
      Deterministic Fallback
    </span>
  );
}

function ToolCallsPanel({ toolCalls }: { toolCalls: AIToolCall[] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 border rounded-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
      >
        <span>{toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}</span>
        <svg className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      {expanded && (
        <div className="divide-y border-t">
          {toolCalls.map((tc) => (
            <div key={tc.id} className="px-3 py-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium text-indigo-700">{tc.toolName}</span>
                <div className="flex items-center gap-2">
                  {tc.authorizationResult && (
                    <Badge variant={tc.authorizationResult === 'APPROVED' ? 'green' : 'red'}>{tc.authorizationResult}</Badge>
                  )}
                  {tc.durationMs != null && (
                    <span className="text-gray-400">{tc.durationMs}ms</span>
                  )}
                </div>
              </div>
              {tc.error && (
                <p className="text-red-600">{tc.error}</p>
              )}
              {tc.output && (
                <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-gray-600 max-h-32 overflow-y-auto">
                  {JSON.stringify(tc.output, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidencePanel({ evidence }: { evidence: AIEvidence[] }) {
  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">Evidence</p>
      {evidence.map((e, i) => (
        <div key={i} className="rounded-md border p-2 text-xs space-y-0.5">
          <div className="flex items-center gap-2">
            <Badge variant={
              e.evidenceType === 'FACT' ? 'green' :
              e.evidenceType === 'INFERENCE' ? 'yellow' : 'blue'
            }>{e.evidenceType}</Badge>
            <span className="text-gray-400">{e.sourceLayer} / {e.sourceType}</span>
            {e.confidence && (
              <span className={`ml-auto ${confidenceColor(e.confidence)}`}>{e.confidence}</span>
            )}
          </div>
          <p className="text-gray-700">{e.description}</p>
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message, onSelect, isSelected }: { message: AIMessage; onSelect: () => void; isSelected: boolean }) {
  const isUser = message.role === 'USER';
  const isSystem = message.role === 'SYSTEM';
  const isTool = message.role === 'TOOL';

  const roleLabel = isUser ? 'You' : isSystem ? 'System' : isTool ? 'Tool' : 'AI';
  const mode = message.responseMode;

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border p-3 cursor-pointer transition-colors ${
        isSelected ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-200' :
        isUser ? 'bg-blue-50 border-blue-100 ml-8' :
        isSystem ? 'bg-gray-100 border-gray-200' :
        isTool ? 'bg-orange-50 border-orange-100 ml-8' :
        'bg-white border-gray-200 mr-8'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">{roleLabel}</span>
          {!isUser && message.role === 'ASSISTANT' && <AIBadge />}
          {mode === 'DETERMINISTIC_FALLBACK' && <DeterministicBadge />}
          {mode === 'AI_ASSISTED' && !isUser && message.role === 'ASSISTANT' && (
            <span className="text-xs text-gray-400">AI Assisted</span>
          )}
        </div>
        <span className="text-xs text-gray-400">{formatDateTime(message.createdAt)}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      {message.confidence && (
        <p className={`text-xs mt-1 ${confidenceColor(message.confidence)}`}>Confidence: {message.confidence}</p>
      )}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <ToolCallsPanel toolCalls={message.toolCalls} />
      )}
    </div>
  );
}

export default function AssistantPage() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<AIMessage | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions, loading: sessionsLoading, error: sessionsError, refetch: refetchSessions } = useApi(
    () => assistantApi.getSessions(), []
  );

  const { data: messages, loading: messagesLoading, error: messagesError, refetch: refetchMessages } = useApi(
    () => activeSessionId ? assistantApi.getMessages(activeSessionId) : Promise.resolve(null),
    [activeSessionId]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = async () => {
    setCreatingSession(true);
    try {
      const session = await assistantApi.createSession();
      setActiveSessionId(session.id);
      setSelectedMessage(null);
      await refetchSessions();
    } finally {
      setCreatingSession(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || !activeSessionId || sending) return;
    const messageText = input.trim();
    setInput('');
    setSending(true);
    try {
      await assistantApi.sendMessage(activeSessionId, messageText);
      await refetchMessages();
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Intelligence', href: '/intelligence' }, { label: 'AI Assistant' }]}
        title="AI Operational Assistant"
        subtitle="Layer 8 Interactivity, Tool-Executing AI & Evidence Grounding"
      />

      <div className="grid grid-cols-12 gap-4" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Left Sidebar - Sessions */}
        <div className="col-span-3 flex flex-col border rounded-lg overflow-hidden">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Conversations</span>
            <button
              onClick={handleNewSession}
              disabled={creatingSession}
              className="btn btn-primary btn-sm text-xs"
            >
              {creatingSession ? '...' : '+ New'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sessionsLoading ? (
              <LoadingSpinner size="sm" />
            ) : sessionsError ? (
              <p className="p-3 text-xs text-red-500">{sessionsError}</p>
            ) : !sessions || sessions.length === 0 ? (
              <p className="p-3 text-xs text-gray-500">No conversations yet.</p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setActiveSessionId(s.id); setSelectedMessage(null); }}
                  className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors ${
                    activeSessionId === s.id ? 'bg-brand-50 border-l-2 border-l-brand-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className="font-medium text-gray-900 truncate">{s.title || 'Untitled Session'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(s.updatedAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center - Messages */}
        <div className="col-span-6 flex flex-col border rounded-lg overflow-hidden">
          {!activeSessionId ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState title="No conversation selected" description="Select a conversation or start a new one." />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messagesLoading ? (
                  <LoadingSpinner />
                ) : messagesError ? (
                  <ErrorState message={messagesError} onRetry={refetchMessages} />
                ) : !messages || messages.length === 0 ? (
                  <EmptyState title="No messages" description="Send a message to start the conversation." />
                ) : (
                  messages.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onSelect={() => setSelectedMessage(msg)}
                      isSelected={selectedMessage?.id === msg.id}
                    />
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Ask the AI assistant..."
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="btn btn-primary btn-sm"
                >
                  {sending ? '...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right Sidebar - Context Panel */}
        <div className="col-span-3 border rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b">
            <span className="text-sm font-semibold text-gray-700">Message Context</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {!selectedMessage ? (
              <p className="text-xs text-gray-500">Select a message to view its context, evidence, and tool calls.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Role</p>
                  <Badge variant={
                    selectedMessage.role === 'USER' ? 'blue' :
                    selectedMessage.role === 'SYSTEM' ? 'gray' :
                    selectedMessage.role === 'TOOL' ? 'yellow' : 'green'
                  }>{selectedMessage.role}</Badge>
                </div>
                {selectedMessage.responseMode && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Response Mode</p>
                    {selectedMessage.responseMode === 'DETERMINISTIC_FALLBACK' ? (
                      <DeterministicBadge />
                    ) : (
                      <Badge variant="green">{selectedMessage.responseMode}</Badge>
                    )}
                  </div>
                )}
                {selectedMessage.confidence && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Confidence</p>
                    <p className={`text-sm font-medium ${confidenceColor(selectedMessage.confidence)}`}>
                      {selectedMessage.confidence}
                    </p>
                  </div>
                )}
                {selectedMessage.evidence && selectedMessage.evidence.length > 0 && (
                  <EvidencePanel evidence={selectedMessage.evidence} />
                )}
                {selectedMessage.toolCalls && selectedMessage.toolCalls.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Tool Calls</p>
                    {selectedMessage.toolCalls.map((tc) => (
                      <div key={tc.id} className="rounded-md border p-2 text-xs space-y-1 mb-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-medium text-indigo-700">{tc.toolName}</span>
                          <span className="text-gray-400">{tc.durationMs != null ? `${tc.durationMs}ms` : ''}</span>
                        </div>
                        {tc.error && <p className="text-red-600">{tc.error}</p>}
                        {tc.output && (
                          <pre className="bg-gray-50 rounded p-2 overflow-x-auto text-gray-600 max-h-40 overflow-y-auto">
                            {JSON.stringify(tc.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {selectedMessage.metadata && Object.keys(selectedMessage.metadata).length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Metadata</p>
                    <pre className="bg-gray-50 rounded p-2 text-xs overflow-x-auto text-gray-600 max-h-40 overflow-y-auto">
                      {JSON.stringify(selectedMessage.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
