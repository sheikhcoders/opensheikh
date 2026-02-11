import { useEffect, useMemo, useCallback, useState } from 'react'
import { createEventStream } from '../services/eventStream'
import type { Message, AssistantMessagePart, MessageMetadata, MessageUpdatedProperties, MessagePartUpdatedProperties, SessionErrorProperties } from '../services/types'
import { getOverallToolStatus, getContextualToolStatus, hasActiveToolExecution, getToolProgress } from '../utils/toolStatusHelpers'
import { useSessionStore } from '../stores/sessionStore'
import { useMessageStore } from '../stores/messageStore'
import { useMessageStoreV2 } from '../stores/messageStoreV2'
import { logger } from '../lib/logger'

export function useEventStream() {
  const [hasReceivedFirstEvent, setHasReceivedFirstEvent] = useState(false)
  const [currentMessageMetadata, setCurrentMessageMetadata] = useState<MessageMetadata | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(false)
  
  const eventStream = useMemo(() => createEventStream(), [])
  const { sessionId, setIdle } = useSessionStore()

  // Keep old store for status/error messages for now
  const { 
    addStatusMessage, 
    addErrorMessage, 
    removeLastEventMessage, 
    setLastStatusMessage 
  } = useMessageStore()

  // New store for core chat messages
  const {
    handleMessageUpdated,
    handlePartUpdated
  } = useMessageStoreV2()

  const updateStatusFromMessage = useCallback((message: Message) => {
    if (!hasReceivedFirstEvent) {
      setHasReceivedFirstEvent(true)
    }
    
    setCurrentMessageMetadata(message.metadata)
    
    // Update new store
    handleMessageUpdated(message)

    if (message.metadata?.time?.completed) {
      setIsLoading(false)
      return
    }

    if (hasActiveToolExecution(message)) {
      const status = getOverallToolStatus(message.parts || [])
      addStatusMessage(status)
    } else {
      const progress = getToolProgress(message)
      if (progress.total > 0) {
        addStatusMessage(`✓ Completed ${progress.total} tool${progress.total > 1 ? 's' : ''}`)
      }
    }
  }, [hasReceivedFirstEvent, addStatusMessage, handleMessageUpdated])

  const updateStatusFromPart = useCallback((part: AssistantMessagePart, messageId: string, messageMetadata?: MessageMetadata) => {
    if (!hasReceivedFirstEvent) {
      setHasReceivedFirstEvent(true)
    }

    // Update new store
    handlePartUpdated(part, messageId)

    if (part.type === 'tool' && part.state) {
      const status = getContextualToolStatus(part, messageMetadata)
      addStatusMessage(status)
    } else if (part.type === 'text') {
      if (part.text && part.text.trim()) {
        logger.debug('Received text part:', { messageId, text: part.text.substring(0, 100) + (part.text.length > 100 ? '...' : '') })
      }
    }
  }, [hasReceivedFirstEvent, addStatusMessage, handlePartUpdated])

  useEffect(() => {
    eventStream.connect()
    
    eventStream.subscribe('message.updated', (data: MessageUpdatedProperties) => {
      updateStatusFromMessage(data.info)
    })
    
    eventStream.subscribe('message.part.updated', (data: MessagePartUpdatedProperties) => {
      updateStatusFromPart(data.part, data.messageID, currentMessageMetadata)
    })
    
    eventStream.subscribe('session.error', (data: SessionErrorProperties) => {
      logger.error('Session error:', data)
      addErrorMessage(data.error.data.message)
    })

    eventStream.subscribe('session.idle', (data: { sessionID: string }) => {
      if (data.sessionID === sessionId) {
        setIdle(true)
        setIsLoading(false)
        removeLastEventMessage()
        setLastStatusMessage('')
      }
    })
    
    return () => {
      eventStream.disconnect()
    }
  }, [eventStream, updateStatusFromMessage, updateStatusFromPart, currentMessageMetadata, sessionId, setIdle, addErrorMessage, removeLastEventMessage, setLastStatusMessage])

  return {
    hasReceivedFirstEvent,
    setHasReceivedFirstEvent,
    isLoading,
    setIsLoading
  }
}
