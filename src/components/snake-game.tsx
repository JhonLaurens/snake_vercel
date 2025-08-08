'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Play, Pause, RotateCcw, Trophy, Timer, Star, Zap } from 'lucide-react'

interface Position {
  x: number
  y: number
}

interface Food {
  x: number
  y: number
  type: 'normal' | 'bonus' | 'speed'
  points: number
}

interface GameStats {
  timeElapsed: number
  foodEaten: number
  bestStreak: number
  currentStreak: number
}

interface GameState {
  snake: Position[]
  food: Food
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  gameOver: boolean
  paused: boolean
  score: number
  gameStarted: boolean
  level: number
  speed: number
  stats: GameStats
}

const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SPEED = 200
const SPEED_INCREASE = 10
const LEVEL_THRESHOLD = 50

// Responsive cell size based on screen size
const getResponsiveCellSize = () => {
  if (typeof window === 'undefined') return CELL_SIZE
  
  const screenWidth = window.innerWidth
  if (screenWidth < 400) return 15
  if (screenWidth < 640) return 18
  return CELL_SIZE
}

// High Score Management
const getHighScore = (): number => {
  if (typeof window === 'undefined') return 0
  return parseInt(localStorage.getItem('snake-high-score') || '0')
}

const setHighScore = (score: number): void => {
  if (typeof window === 'undefined') return
  localStorage.setItem('snake-high-score', score.toString())
}

// Sound Effects
const playSound = (type: 'eat' | 'gameOver' | 'levelUp') => {
  if (typeof window === 'undefined') return
  
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  
  switch (type) {
    case 'eat':
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.2)
      break
    case 'gameOver':
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime + 0.5)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 1)
      break
    case 'levelUp':
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1)
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2)
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
      break
  }
}

export default function SnakeGame() {
  const [gameState, setGameState] = useState<GameState>({
    snake: [{ x: 10, y: 10 }],
    food: { x: 15, y: 15, type: 'normal', points: 10 },
    direction: 'RIGHT',
    gameOver: false,
    paused: false,
    score: 0,
    gameStarted: false,
    level: 1,
    speed: INITIAL_SPEED,
    stats: {
      timeElapsed: 0,
      foodEaten: 0,
      bestStreak: 0,
      currentStreak: 0
    }
  })

  const [cellSize, setCellSize] = useState(CELL_SIZE)
  const [highScore, setHighScore] = useState(0)
  const [showParticles, setShowParticles] = useState<Position[]>([])
  const gameLoopRef = useRef<NodeJS.Timeout | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const directionRef = useRef(gameState.direction)
  const startTimeRef = useRef<number>(0)

  // Initialize high score
  useEffect(() => {
    setHighScore(getHighScore())
  }, [])

  // Handle responsive cell size
  useEffect(() => {
    const handleResize = () => {
      setCellSize(getResponsiveCellSize())
    }

    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Generar comida aleatoria con diferentes tipos
  const generateFood = useCallback((): Food => {
    const x = Math.floor(Math.random() * GRID_SIZE)
    const y = Math.floor(Math.random() * GRID_SIZE)
    
    // Asegurar que la comida no aparezca en la serpiente
    const isOnSnake = gameState.snake.some(segment => 
      segment.x === x && segment.y === y
    )
    
    if (isOnSnake) {
      return generateFood()
    }
    
    // Determinar tipo de comida (90% normal, 7% bonus, 3% speed)
    const rand = Math.random()
    let type: 'normal' | 'bonus' | 'speed' = 'normal'
    let points = 10
    
    if (rand < 0.03) {
      type = 'speed'
      points = 5
    } else if (rand < 0.1) {
      type = 'bonus'
      points = 25
    }
    
    return { x, y, type, points }
  }, [gameState.snake])

  // Iniciar juego
  const startGame = () => {
    const newFood = generateFood()
    setGameState({
      snake: [{ x: 10, y: 10 }],
      food: newFood,
      direction: 'RIGHT',
      gameOver: false,
      paused: false,
      score: 0,
      gameStarted: true,
      level: 1,
      speed: INITIAL_SPEED,
      stats: {
        timeElapsed: 0,
        foodEaten: 0,
        bestStreak: 0,
        currentStreak: 0
      }
    })
    directionRef.current = 'RIGHT'
    startTimeRef.current = Date.now()
    setShowParticles([])
    
    // Start timer
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        stats: {
          ...prev.stats,
          timeElapsed: Math.floor((Date.now() - startTimeRef.current) / 1000)
        }
      }))
    }, 1000)
  }

  // Pausar/reanudar juego
  const togglePause = () => {
    setGameState(prev => ({
      ...prev,
      paused: !prev.paused
    }))
  }

  // Touch controls
  const handleDirectionChange = (newDirection: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (!gameState.gameStarted) return
    
    const opposites = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    }
    
    if (directionRef.current !== opposites[newDirection]) {
      directionRef.current = newDirection
    }
  }

  // Mover serpiente
  const moveSnake = useCallback(() => {
    if (gameState.gameOver || gameState.paused || !gameState.gameStarted) return

    setGameState(prev => {
      const head = { ...prev.snake[0] }
      
      // Mover cabeza según dirección
      switch (directionRef.current) {
        case 'UP':
          head.y -= 1
          break
        case 'DOWN':
          head.y += 1
          break
        case 'LEFT':
          head.x -= 1
          break
        case 'RIGHT':
          head.x += 1
          break
      }

      // Verificar colisiones con paredes
      if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
        playSound('gameOver')
        if (timerRef.current) clearInterval(timerRef.current)
        
        // Update high score
        if (prev.score > getHighScore()) {
          setHighScore(prev.score)
        }
        
        return { ...prev, gameOver: true }
      }

      // Verificar colisiones con sí misma
      if (prev.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
        playSound('gameOver')
        if (timerRef.current) clearInterval(timerRef.current)
        
        // Update high score
        if (prev.score > getHighScore()) {
          setHighScore(prev.score)
        }
        
        return { ...prev, gameOver: true }
      }

      const newSnake = [head, ...prev.snake]
      
      // Verificar si come comida
      if (head.x === prev.food.x && head.y === prev.food.y) {
        playSound('eat')
        
        // Add particle effect
        setShowParticles(current => [...current, { x: head.x, y: head.y }])
        setTimeout(() => {
          setShowParticles(current => current.slice(1))
        }, 500)
        
        const newScore = prev.score + prev.food.points
        const newFoodEaten = prev.stats.foodEaten + 1
        const newStreak = prev.stats.currentStreak + 1
        const newLevel = Math.floor(newScore / LEVEL_THRESHOLD) + 1
        const newSpeed = Math.max(50, INITIAL_SPEED - (newLevel - 1) * SPEED_INCREASE)
        
        // Level up sound
        if (newLevel > prev.level) {
          playSound('levelUp')
        }
        
        // Speed boost for speed food
        let speedBoost = 0
        if (prev.food.type === 'speed') {
          speedBoost = 30
        }
        
        return {
          ...prev,
          snake: newSnake,
          food: generateFood(),
          score: newScore,
          level: newLevel,
          speed: Math.max(30, newSpeed - speedBoost),
          stats: {
            ...prev.stats,
            foodEaten: newFoodEaten,
            currentStreak: newStreak,
            bestStreak: Math.max(prev.stats.bestStreak, newStreak)
          }
        }
      }

      // Si no come, quitar cola
      newSnake.pop()
      
      return {
        ...prev,
        snake: newSnake,
        stats: {
          ...prev.stats,
          currentStreak: 0 // Reset streak if no food eaten
        }
      }
    })
  }, [gameState.gameOver, gameState.paused, gameState.gameStarted, generateFood])

  // Manejar controles de teclado
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameState.gameStarted) return

      switch (e.key) {
        case 'ArrowUp':
          if (directionRef.current !== 'DOWN') {
            directionRef.current = 'UP'
          }
          break
        case 'ArrowDown':
          if (directionRef.current !== 'UP') {
            directionRef.current = 'DOWN'
          }
          break
        case 'ArrowLeft':
          if (directionRef.current !== 'RIGHT') {
            directionRef.current = 'LEFT'
          }
          break
        case 'ArrowRight':
          if (directionRef.current !== 'LEFT') {
            directionRef.current = 'RIGHT'
          }
          break
        case ' ':
          togglePause()
          break
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [gameState.gameStarted])

  // Game loop with dynamic speed
  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameOver && !gameState.paused) {
      gameLoopRef.current = setInterval(moveSnake, gameState.speed)
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
    }
  }, [gameState.gameStarted, gameState.gameOver, gameState.paused, gameState.speed, moveSnake])

  // Limpiar al desmontar
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-green-900 to-green-700 p-4">
      <div className="bg-black rounded-lg p-6 shadow-2xl max-w-4xl w-full">
        {/* Header with stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-white">
          <div className="text-center">
            <div className="text-sm text-gray-400">Puntuación</div>
            <div className="text-xl font-bold text-green-400">{gameState.score}</div>
          </div>
          <div className="text-center">
             <div className="text-sm text-gray-400">Récord</div>
             <div className="text-xl font-bold text-yellow-400">{highScore}</div>
           </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Nivel</div>
            <div className="text-xl font-bold text-blue-400">{gameState.level}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Tiempo</div>
            <div className="text-xl font-bold text-purple-400">
              {Math.floor(gameState.stats.timeElapsed / 60)}:{(gameState.stats.timeElapsed % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>

        {/* Game controls */}
        <div className="flex justify-between items-center mb-4">
          <div className="text-white text-sm">
            <div>Comida: {gameState.stats.foodEaten} | Racha: {gameState.stats.currentStreak}</div>
            <div>Mejor racha: {gameState.stats.bestStreak}</div>
          </div>
          {gameState.gameStarted && (
            <button
              onClick={togglePause}
              className="px-4 py-2 bg-yellow-500 text-black rounded hover:bg-yellow-400 transition-colors flex items-center gap-2"
            >
              {gameState.paused ? <Play size={16} /> : <Pause size={16} />}
              {gameState.paused ? 'Reanudar' : 'Pausar'}
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Game board */}
          <div className="flex-1 flex justify-center">
            <div 
              className="relative bg-gray-800 border-2 border-gray-600 rounded"
              style={{
                width: `${GRID_SIZE * cellSize}px`,
                height: `${GRID_SIZE * cellSize}px`,
              }}
            >
              {/* Serpiente - solo mostrar cuando el juego está activo */}
              {gameState.gameStarted && !gameState.gameOver && gameState.snake.map((segment, index) => (
                <div
                  key={index}
                  className={`absolute ${
                    index === 0 ? 'bg-green-400 shadow-lg' : 'bg-green-500'
                  } border border-green-300 rounded-sm transition-all duration-100`}
                  style={{
                    left: `${segment.x * cellSize}px`,
                    top: `${segment.y * cellSize}px`,
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    zIndex: 10,
                  }}
                />
              ))}

              {/* Comida con diferentes tipos - solo mostrar cuando el juego está activo */}
              {gameState.gameStarted && !gameState.gameOver && (
                <div
                  className={`absolute border rounded-full transition-all duration-200 ${
                    gameState.food.type === 'normal' ? 'bg-red-500 border-red-300' :
                    gameState.food.type === 'bonus' ? 'bg-yellow-500 border-yellow-300 shadow-lg' :
                    'bg-blue-500 border-blue-300 shadow-lg animate-pulse'
                  }`}
                  style={{
                    left: `${gameState.food.x * cellSize}px`,
                    top: `${gameState.food.y * cellSize}px`,
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    zIndex: 5,
                  }}
                >
                  {gameState.food.type === 'bonus' && (
                     <Star className="w-full h-full text-white p-1" />
                   )}
                   {gameState.food.type === 'speed' && (
                     <Zap className="w-full h-full text-white p-1" />
                   )}
                </div>
              )}

              {/* Particle effects */}
              {showParticles.map((particle, index) => (
                <div
                  key={index}
                  className="absolute bg-yellow-400 rounded-full animate-ping"
                  style={{
                    left: `${particle.x * cellSize + cellSize/4}px`,
                    top: `${particle.y * cellSize + cellSize/4}px`,
                    width: `${cellSize/2}px`,
                    height: `${cellSize/2}px`,
                    zIndex: 20,
                  }}
                />
              ))}

              {/* Overlay de estado */}
              {(!gameState.gameStarted || gameState.gameOver || gameState.paused) && (
                <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center">
                  <div className="text-center text-white">
                    {!gameState.gameStarted && (
                      <>
                        <h2 className="text-3xl font-bold mb-4 text-green-400">Snake Game</h2>
                        <p className="mb-4">Usa las flechas o los botones para moverte</p>
                        <p className="mb-4 text-sm text-gray-300">
                           🔴 Normal (+10) • ⭐ Bonus (+25) • ⚡ Velocidad (+15)
                         </p>
                        <button
                          onClick={startGame}
                          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2 mx-auto"
                        >
                          <Play size={20} />
                          Iniciar Juego
                        </button>
                      </>
                    )}
                    {gameState.gameOver && (
                      <>
                        <h2 className="text-3xl font-bold mb-4 text-red-400">¡Juego Terminado!</h2>
                        <div className="mb-4 space-y-2">
                          <p>Puntuación final: <span className="text-green-400 font-bold">{gameState.score}</span></p>
                          <p>Nivel alcanzado: <span className="text-blue-400 font-bold">{gameState.level}</span></p>
                          <p>Tiempo jugado: <span className="text-purple-400 font-bold">
                            {Math.floor(gameState.stats.timeElapsed / 60)}:{(gameState.stats.timeElapsed % 60).toString().padStart(2, '0')}
                          </span></p>
                          {gameState.score === highScore && gameState.score > 0 && (
                            <p className="text-yellow-400 font-bold flex items-center justify-center gap-2">
                              <Trophy size={20} />
                              ¡Nuevo récord!
                            </p>
                          )}
                        </div>
                        <button
                          onClick={startGame}
                          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-400 transition-colors flex items-center gap-2 mx-auto"
                        >
                          <RotateCcw size={20} />
                          Jugar de Nuevo
                        </button>
                      </>
                    )}
                    {gameState.paused && (
                      <>
                        <h2 className="text-3xl font-bold mb-4 text-yellow-400">Pausado</h2>
                        <p className="mb-4">Presiona Espacio o el botón para continuar</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Touch controls for mobile */}
          <div className="lg:w-48 flex lg:flex-col justify-center items-center">
            <div className="grid grid-cols-3 gap-2 lg:gap-3">
              <div></div>
              <button
                onClick={() => handleDirectionChange('UP')}
                className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                disabled={!gameState.gameStarted || gameState.gameOver}
              >
                <ChevronUp size={24} />
              </button>
              <div></div>
              
              <button
                onClick={() => handleDirectionChange('LEFT')}
                className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                disabled={!gameState.gameStarted || gameState.gameOver}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={togglePause}
                className="w-12 h-12 lg:w-16 lg:h-16 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg flex items-center justify-center transition-colors"
                disabled={!gameState.gameStarted || gameState.gameOver}
              >
                {gameState.paused ? <Play size={20} /> : <Pause size={20} />}
              </button>
              <button
                onClick={() => handleDirectionChange('RIGHT')}
                className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                disabled={!gameState.gameStarted || gameState.gameOver}
              >
                <ChevronRight size={24} />
              </button>
              
              <div></div>
              <button
                onClick={() => handleDirectionChange('DOWN')}
                className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-700 hover:bg-gray-600 text-white rounded-lg flex items-center justify-center transition-colors"
                disabled={!gameState.gameStarted || gameState.gameOver}
              >
                <ChevronDown size={24} />
              </button>
              <div></div>
            </div>
          </div>
        </div>

        <div className="mt-4 text-center text-white text-sm">
          <p>Usa las flechas del teclado o los botones • Espacio para pausar</p>
          <p className="text-gray-400 mt-1">
             🔴 Comida normal (+10) • ⭐ Comida bonus (+25) • ⚡ Comida velocidad (+15, acelera temporalmente)
           </p>
        </div>
      </div>
    </div>
  )
}