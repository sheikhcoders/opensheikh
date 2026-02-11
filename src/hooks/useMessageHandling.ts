import { useCallback } from 'react'
import { sendMessage } from '../services/api'
import { createTextMessageRequest } from '../utils/apiHelpers'
import { useSessionStore } from '../stores/sessionStore'
import { useModelStore } from '../stores/modelStore'
import { useMessageStore } from '../stores/messageStore'
import { useMessageStoreV2 } from '../stores/messageStoreV2'
import { logger } from '../lib/logger'
import type { Message, AssistantMessagePart } from '../services/types'

export function useMessageHandling() {
  const { sessionId, isInitializing, setIdle } = useSessionStore()
  const { selectedModel, getProviderForModel } = useModelStore()

  // Keep old store for status messages
  const { 
    addStatusMessage, 
    addUserMessage: addUserMessageOld,
    addErrorMessage, 
    setLastStatusMessage 
  } = useMessageStore()

  // New store
  const { addUserMessage: addUserMessageV2 } = useMessageStoreV2()

  const handleMessageSubmit = useCallback(async (
    userInput: string, 
    selectedMode: string,
    isLoading: boolean,
    setIsLoading: (loading: boolean) => void,
    hasReceivedFirstEvent: boolean,
    setHasReceivedFirstEvent: (received: boolean) => void
  ) => {
    if (!userInput || !sessionId || isLoading || isInitializing) return
    
    setIsLoading(true)
    setHasReceivedFirstEvent(false)
    setLastStatusMessage('') // Reset last status for new conversation
    setIdle(false) // Reset idle state when starting new message
    
    // Get the correct provider for the selected model
    const providerId = getProviderForModel(selectedModel)
    const request = createTextMessageRequest(userInput, sessionId, providerId, selectedModel, selectedMode)

    // Add user message to both stores for now to keep UI working until fully migrated
    addUserMessageOld(userInput)

    const userMessage: Message = {
      id: request.messageID,
      role: 'user',
      parts: request.parts as AssistantMessagePart[], // Casting to align with Message type in types.ts
      metadata: {
        time: { created: Date.now() },
        sessionID: sessionId,
        tool: {}
      }
    }
    addUserMessageV2(userMessage)
    
    try {
      const response = await sendMessage(sessionId, request)
      // logger.debug('Message response:', response)
      
      // If we haven't received any events yet, handle the response directly
      if (!hasReceivedFirstEvent) {
        const hasTools = response.parts.some(part => part.type === 'tool')
        if (hasTools) {
          addStatusMessage('Processing tools...')
        }
      }
      
    } catch (error) {
      logger.error('Failed to send message:', error)
      addErrorMessage(`Failed to send message - ${error}`)
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, isInitializing, selectedModel, getProviderForModel, addUserMessageOld, addUserMessageV2, addStatusMessage, setLastStatusMessage, setIdle, addErrorMessage])

  return {
    handleMessageSubmit
  }
}
