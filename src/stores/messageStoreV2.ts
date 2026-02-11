import { create } from 'zustand'
import type { Message, AssistantMessagePart } from '../services/types'

interface MessageStoreV2State {
  messages: Message[]
  
  // Session management
  hydrateFromSession: (messages: Message[]) => void
  
  // Event stream handlers
  handleMessageUpdated: (info: Message) => void
  handlePartUpdated: (part: AssistantMessagePart, messageId: string) => void
  handleMessageRemoved: (messageId: string) => void
  
  // User actions
  addUserMessage: (message: Message) => void
  clearMessages: () => void
}

export const useMessageStoreV2 = create<MessageStoreV2State>((set) => ({
  messages: [],
  
  hydrateFromSession: (messages: Message[]) => {
    set({ messages })
  },
  
  handleMessageUpdated: (info: Message) => {
    set((state) => {
      const existingIndex = state.messages.findIndex(msg => msg.id === info.id)
      if (existingIndex >= 0) {
        const updatedMessages = [...state.messages]
        updatedMessages[existingIndex] = {
          ...info,
          parts: info.parts || updatedMessages[existingIndex].parts || []
        }
        return { messages: updatedMessages }
      } else {
        return {
          messages: [...state.messages, info]
        }
      }
    })
  },
  
  handlePartUpdated: (part: AssistantMessagePart, messageId: string) => {
    set((state) => {
      const messageIndex = state.messages.findIndex(msg => msg.id === messageId)
      if (messageIndex >= 0) {
        const updatedMessages = [...state.messages]
        const message = { ...updatedMessages[messageIndex] }
        const parts = [...(message.parts || [])]
        
        // Only ToolPart and TextPart have IDs in the current types
        const partWithId = part as { id?: string }
        if (partWithId.id) {
          const partIndex = parts.findIndex(p => (p as { id?: string }).id === partWithId.id)
          if (partIndex >= 0) {
            parts[partIndex] = part
          } else {
            parts.push(part)
          }
        } else {
          // If no ID, we just append it (e.g. step-start/finish)
          // unless we already have an identical one (to avoid duplicates if events are replayed)
          // For now, let's just push.
          parts.push(part)
        }
        
        message.parts = parts
        updatedMessages[messageIndex] = message

        return { messages: updatedMessages }
      }
      return state
    })
  },
  
  handleMessageRemoved: (messageId: string) => {
    set((state) => ({
      messages: state.messages.filter(msg => msg.id !== messageId)
    }))
  },
  
  addUserMessage: (message: Message) => {
    set((state) => ({
      messages: [...state.messages, message]
    }))
  },
  
  clearMessages: () => {
    set({ messages: [] })
  }
}))
