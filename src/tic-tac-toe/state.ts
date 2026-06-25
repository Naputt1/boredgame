export type CellMark = 'X' | 'O' | null

export type Board = [
  [CellMark, CellMark, CellMark],
  [CellMark, CellMark, CellMark],
  [CellMark, CellMark, CellMark],
]

export type TicTacToeState = {
  board: Board
  currentPlayer: 'X' | 'O'
  winner: CellMark | 'tie'
  players: Record<string, { id: string; mark: 'X' | 'O'; name: string }>
  appliedActionIds: string[]
}

export const EMPTY_BOARD: Board = [
  [null, null, null],
  [null, null, null],
  [null, null, null],
]

export const createInitialState = (): TicTacToeState => ({
  board: EMPTY_BOARD,
  currentPlayer: 'X',
  winner: null,
  players: {},
  appliedActionIds: [],
})

export const WINNING_LINES: Array<
  [[number, number], [number, number], [number, number]]
> = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [1, 2],
  ],
  [
    [2, 0],
    [2, 1],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
  ],
  [
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 2],
    [1, 2],
    [2, 2],
  ],
  [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  [
    [0, 2],
    [1, 1],
    [2, 0],
  ],
]

export const computeWinner = (board: Board): CellMark | 'tie' | null => {
  for (const [[r1, c1], [r2, c2], [r3, c3]] of WINNING_LINES) {
    const mark = board[r1][c1]
    if (mark && mark === board[r2][c2] && mark === board[r3][c3]) {
      return mark
    }
  }
  const hasEmpty = board.some((row) => row.some((cell) => cell === null))
  return hasEmpty ? null : 'tie'
}
