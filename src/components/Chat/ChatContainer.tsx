import { useRef, useEffect, memo, useMemo } from 'react'
import { ScrollArea } from '../ui/scroll-area'
import { MessageBubble, type UnifiedMessage } from './MessageBubble'
import { useMessageStore } from '../../stores/messageStore'
import { useMessageStoreV2 } from '../../stores/messageStoreV2'

interface ChatContainerProps {
  isLoading: boolean
}

const MemoizedMessageBubble = memo(MessageBubble)

export const ChatContainer = ({ isLoading }: ChatContainerProps) => {
  const { messages: apiMessages } = useMessageStoreV2()
  const { messages: legacyMessages } = useMessageStore()
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Merge messages for display:
  // We want to show API messages (user/assistant) and Legacy messages (only events/errors)
  const displayMessages = useMemo(() => {
    // Filter legacy messages to only include events and errors to avoid duplicates
    const eventsAndErrors = legacyMessages.filter(m => m.type === 'event' || m.type === 'error')

    // Map API messages to a format compatible with MessageBubble
    const unified: UnifiedMessage[] = [
      ...apiMessages.map(m => ({
        id: m.id,
        type: m.role as 'user' | 'assistant',
        timestamp: m.metadata?.time?.created || Date.now(),
        isApiMessage: true as const,
        rawMessage: m
      })),
      ...eventsAndErrors.map(m => ({
        ...m,
        isApiMessage: false as const
      }))
    ]

    // Sort by timestamp
    return unified.sort((a, b) => a.timestamp - b.timestamp)
  }, [apiMessages, legacyMessages])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [displayMessages, isLoading])

  return (
    <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-280px)] mb-4 border rounded-lg p-4">
      <div className="space-y-4">
        {displayMessages.map((message) => (
          <MemoizedMessageBubble key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  )
}
