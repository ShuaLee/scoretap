import axios from 'axios'
import type {
  CreateGameInput,
  Game,
  PlateAppearanceResponse,
  PlateAppearanceResult,
} from '../types/game'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api',
})

export async function createGame(input: CreateGameInput): Promise<Game> {
  const response = await api.post<Game>('/games/', input)
  return response.data
}

export async function recordPlateAppearance(
  gameId: number,
  result: PlateAppearanceResult,
): Promise<PlateAppearanceResponse> {
  const response = await api.post<PlateAppearanceResponse>(
    `/games/${gameId}/plate-appearances/`,
    { result },
  )
  return response.data
}

export async function undoLastEvent(gameId: number): Promise<Game> {
  const response = await api.post<Game>(`/games/${gameId}/undo/`)
  return response.data
}

export async function finalizeGame(gameId: number): Promise<Game> {
  const response = await api.post<Game>(`/games/${gameId}/finalize/`)
  return response.data
}
