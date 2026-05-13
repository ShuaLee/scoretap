import { create } from 'zustand'
import {
  createGame,
  finalizeGame,
  recordPlateAppearance,
  undoLastEvent,
} from '../services/api'
import type { CreateGameInput, Game, PlateAppearanceResult } from '../types/game'

type GameStore = {
  currentGame: Game | null
  isLoading: boolean
  error: string | null
  startGame: (input: CreateGameInput) => Promise<void>
  scoreResult: (result: PlateAppearanceResult) => Promise<void>
  undo: () => Promise<void>
  finalize: () => Promise<void>
  clearError: () => void
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  return 'Something went wrong.'
}

export const useGameStore = create<GameStore>((set, get) => ({
  currentGame: null,
  isLoading: false,
  error: null,

  async startGame(input) {
    set({ isLoading: true, error: null })
    try {
      const game = await createGame(input)
      set({ currentGame: game, isLoading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
      throw error
    }
  },

  async scoreResult(result) {
    const game = get().currentGame
    if (!game) return

    set({ isLoading: true, error: null })
    try {
      const response = await recordPlateAppearance(game.id, result)
      set({ currentGame: response.game, isLoading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
    }
  },

  async undo() {
    const game = get().currentGame
    if (!game) return

    set({ isLoading: true, error: null })
    try {
      const updatedGame = await undoLastEvent(game.id)
      set({ currentGame: updatedGame, isLoading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
    }
  },

  async finalize() {
    const game = get().currentGame
    if (!game) return

    set({ isLoading: true, error: null })
    try {
      const updatedGame = await finalizeGame(game.id)
      set({ currentGame: updatedGame, isLoading: false })
    } catch (error) {
      set({ error: getErrorMessage(error), isLoading: false })
    }
  },

  clearError() {
    set({ error: null })
  },
}))
