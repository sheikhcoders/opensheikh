import React, { memo, useState } from 'react'
import { Avatar, AvatarFallback } from '../ui/avatar'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import type { Message, AssistantMessagePart, ToolStateRunning, ToolStateCompleted, ToolStateError } from '../../services/types'
import type { ChatMessage } from '../../stores/messageStore'
import { ChevronDown, ChevronRight, Terminal } from 'lucide-react'

export type UnifiedMessage = (ChatMessage & { isApiMessage?: false }) | {
  id: string
  type: 'user' | 'assistant'
  timestamp: number
  isApiMessage: true
  rawMessage: Message
}

interface MessageBubbleProps {
  message: UnifiedMessage
}

const ToolResultDisplay = ({ part }: { part: AssistantMessagePart }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (part.type !== 'tool') return null

  const { tool, state } = part
  const isCompleted = state.status === 'completed'
  const isError = state.status === 'error'
  const hasResult = isCompleted && (state as ToolStateCompleted).result

  // Type guards for args
  const hasArgs = state.status !== 'pending' && (state as ToolStateRunning | ToolStateCompleted | ToolStateError).args

  return (
    <div className="my-2 border rounded-md overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 bg-gray-50 hover:bg-gray-100 transition-colors text-xs font-medium text-gray-700"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Terminal size={14} className="text-blue-500" />
          <span>{tool}</span>
          <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${
            isCompleted ? 'bg-green-100 text-green-700' :
            isError ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {state.status}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 border-t bg-gray-900 text-gray-100 font-mono text-xs overflow-x-auto max-h-96">
          {hasArgs && (
            <div className="mb-2 text-blue-300">
              <span className="text-gray-500"># Arguments</span>
              <pre className="mt-1 whitespace-pre-wrap">
                {JSON.stringify((state as ToolStateRunning | ToolStateCompleted | ToolStateError).args, null, 2)}
              </pre>
            </div>
          )}
          {hasResult && (
            <div>
              <span className="text-gray-500"># Result</span>
              <pre className="mt-1 whitespace-pre-wrap">{(state as ToolStateCompleted).result}</pre>
            </div>
          )}
          {isError && (
            <div className="text-red-400">
              <span className="text-gray-500"># Error</span>
              <pre className="mt-1 whitespace-pre-wrap">{(state as ToolStateError).error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export const MessageBubble = memo(({ message }: MessageBubbleProps) => {
  const renderContent = () => {
    if (!message.isApiMessage) {
      return <div className="whitespace-pre-wrap">{message.content}</div>
    }

    const { rawMessage } = message
    return (
      <div className="space-y-2">
        {rawMessage.parts.map((part, index) => {
          if (part.type === 'text') {
            return (
              <ReactMarkdown
                key={index}
                components={{
                  code({ inline, className, children, ...props }: {
                    inline?: boolean
                    className?: string
                    children?: React.ReactNode
                  }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        {...props}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {part.text}
              </ReactMarkdown>
            )
          }
          if (part.type === 'tool') {
            return <ToolResultDisplay key={index} part={part} />
          }
          return null
        })}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 max-w-full">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarFallback>
          {message.type === 'user' ? 'U' :
           message.type === 'assistant' ? 'A' :
           message.type === 'event' ? '⚡' : '!'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
         <div className={`rounded-lg p-3 max-w-full ${
           message.type === 'user' ? 'bg-blue-50' :
           message.type === 'event' ? 'bg-yellow-50 text-yellow-800' :
           message.type === 'error' ? 'bg-red-50 text-red-700' :
           'bg-gray-50'
         } ${message.type === 'assistant' ? 'prose prose-sm max-w-none' : ''}`}>
           {renderContent()}

           {!message.isApiMessage && message.type === 'event' && message.content.includes('...') && (
             <div className="mt-2">
               <div className="animate-pulse flex space-x-1">
                 <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                 <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                 <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
               </div>
             </div>
           )}
         </div>
       </div>
     </div>
  )
})

MessageBubble.displayName = "MessageBubble"

export default MessageBubble
