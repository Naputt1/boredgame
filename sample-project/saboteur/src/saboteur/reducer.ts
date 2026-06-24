import type { SaboteurAction } from "./actions";
import {
  createInitialState,
  type SaboteurState,
  type Card,
  type PlayerId,
  type PathCard,
  type ActionCard,
  type ActionType,
  type Role,
  type CellContent,
  type GoalCardState,
  BOARD_COLS,
  BOARD_ROWS,
  START_COL,
  START_ROW,
  GOAL_COLS,
  canPlacePath,
  hasPathToGoal,
  getHandSize,
  getSaboteurCount,
  getStartCard,
  getGoalCard,
  buildDeck,
  noPlayableCards,
  buildNuggetPool,
} from "./state";

const appendId = (s: SaboteurState, id: string): string[] => [...s.appliedActionIds, id];

const removeCard = <T extends Card>(arr: T[], id: string): T[] => {
  const idx = arr.findIndex(c => c.id === id);
  return idx === -1 ? arr : [...arr.slice(0, idx), ...arr.slice(idx + 1)];
};

const shuffle = <T>(arr: T[]): T[] => {
  const r = [...arr];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

const drawCards = (deck: Card[], count: number): { drawn: Card[]; remaining: Card[] } => {
  const d = [...deck];
  const drawn = d.splice(0, count);
  return { drawn, remaining: d };
};

const getRoleCounts = (totalPlayers: number): { miners: number; saboteurs: number } => {
  const s = getSaboteurCount(totalPlayers);
  return { miners: totalPlayers - s, saboteurs: s };
};

const getSaboteurPayout = (state: SaboteurState): number => {
  const sCount = Object.values(state.roles).filter(r => r === "saboteur").length;
  if (sCount <= 1) return 4;
  if (sCount <= 3) return 3;
  return 2;
};

const replaceOrAddCell = (
  board: (CellContent | null)[][],
  col: number,
  row: number,
  content: CellContent,
): (CellContent | null)[][] => {
  const b = board.map(r => [...r]);
  b[row] = [...b[row]];
  b[row][col] = content;
  return b;
};

type ClonedGoal = Omit<GoalCardState, 'id'> & { id: string };

export const saboteurReducer = (
  state: SaboteurState,
  action: SaboteurAction,
): SaboteurState => {
  if (state.appliedActionIds.includes(action.meta.actionId)) {
    return state;
  }

  switch (action.type) {
    case "join.game": {
      if (state.phase !== "joining") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      if (state.players[action.payload.playerId]) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      if (Object.keys(state.players).length >= 10) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const newPlayers = {
        ...state.players,
        [action.payload.playerId]: { id: action.payload.playerId, name: action.payload.name },
      };
      const newOrder = [...state.playerOrder, action.payload.playerId];
      const playerCount = newOrder.length;

      if (playerCount >= 3) {
        // Auto-start game
        const roleCounts = getRoleCounts(playerCount);
        const roleDeck: Role[] = [
          ...Array(roleCounts.miners).fill("miner" as Role),
          ...Array(roleCounts.saboteurs).fill("saboteur" as Role),
        ];
        const shuffledRoles = shuffle(roleDeck);
        const roles: Record<PlayerId, Role> = {};
        newOrder.forEach((pid, i) => { roles[pid] = shuffledRoles[i]; });

        const shuffledDeck = shuffle(state.deck);
        const handSize = getHandSize(playerCount);
        const hands: Record<PlayerId, Card[]> = {};
        let deckPtr = 0;
        for (const pid of newOrder) {
          const hand: Card[] = [];
          for (let h = 0; h < handSize; h++) {
            if (deckPtr < shuffledDeck.length) {
              hand.push({ ...shuffledDeck[deckPtr++] });
            }
          }
          hands[pid] = hand;
        }

        return {
          ...state,
          players: newPlayers,
          playerOrder: newOrder,
          roles,
          hands,
          deck: shuffledDeck.slice(deckPtr),
          brokenTools: {},
          phase: "playing",
          currentPlayerIndex: 0,
          pendingAction: null,
          goldDist: null,
          appliedActionIds: appendId(state, action.meta.actionId),
        };
      }

      return {
        ...state,
        players: newPlayers,
        playerOrder: newOrder,
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "play.path": {
      if (state.phase !== "playing") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const pid = action.meta.playerId;
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      // Check broken tools
      const broken = state.brokenTools[pid];
      if (broken && broken.length > 0) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const hand = state.hands[pid];
      if (!hand) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const cardIdx = hand.findIndex(c => c.id === action.payload.cardId);
      if (cardIdx === -1) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const card = hand[cardIdx] as PathCard;
      if (card.suit !== "path") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const { col, row, rotation } = action.payload;

      // Build the card with the requested rotation
      const placedCard: PathCard = {
        ...card,
        rotation: rotation ?? 0,
        connections: rotateConnectionsForAction(card, rotation ?? 0),
      };

      if (!canPlacePath(state.board, col, row, placedCard, BOARD_COLS, BOARD_ROWS, state.startPos, state.goalCards)) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const newHand = removeCard(hand, card.id);
      const newBoard = replaceOrAddCell(state.board, col, row, { card: placedCard });

      // Check if this path reaches any goal card
      const reachedGoal = state.goalCards.find(
        g => !g.revealed && Math.abs(g.col - col) <= 1 && Math.abs(g.row - row) <= 1 &&
          hasPathToGoal(newBoard, g.col, g.row, BOARD_COLS, BOARD_ROWS, state.startPos, state.goalCards)
      );

      if (reachedGoal) {
        // Reveal the goal
        const newGoals = state.goalCards.map(g => {
          if (g.id === reachedGoal.id) return { ...g, revealed: true };
          return g;
        });

        if (reachedGoal.isTreasure) {
          // Gold! Place the goal card on the board
          const goalCard = getGoalCard(true);
          const boardWithGoal = replaceOrAddCell(newBoard, reachedGoal.col, reachedGoal.row, { card: goalCard });

          // Draw card, advance turn
          const drawResult = state.deck.length > 0 ? drawCards(state.deck, 1) : { drawn: [], remaining: state.deck };
          const finalHand = drawResult.drawn.length > 0 ? [...newHand, ...drawResult.drawn] : newHand;

          const minerOrder = state.playerOrder.filter(p => state.roles[p] === "miner");
          const pool = buildNuggetPool();
          const drawCount = minerOrder.length;

          return {
            ...state,
            board: boardWithGoal,
            goalCards: newGoals,
            hands: { ...state.hands, [pid]: finalHand },
            deck: drawResult.remaining,
            currentPlayerIndex: (state.currentPlayerIndex + 1) % state.playerOrder.length,
            phase: "round-end",
            lastPathPlayerId: pid,
            goldDist: {
              mode: "miners-win",
              chooserChain: minerOrder,
              currentChooserIdx: minerOrder.indexOf(pid),
              nuggetPool: pool.slice(0, drawCount),
              saboteurPayout: 0,
            },
            appliedActionIds: appendId(state, action.meta.actionId),
          };
        } else {
          // Stone — place the goal card on the board
          const goalCard = getGoalCard(false);
          const boardWithGoal = replaceOrAddCell(newBoard, reachedGoal.col, reachedGoal.row, { card: goalCard });

          // Draw and advance
          const drawResult = state.deck.length > 0 ? drawCards(state.deck, 1) : { drawn: [], remaining: state.deck };
          const finalHand = drawResult.drawn.length > 0 ? [...newHand, ...drawResult.drawn] : newHand;

          return {
            ...state,
            board: boardWithGoal,
            goalCards: newGoals,
            hands: { ...state.hands, [pid]: finalHand },
            deck: drawResult.remaining,
            currentPlayerIndex: (state.currentPlayerIndex + 1) % state.playerOrder.length,
            lastPathPlayerId: pid,
            appliedActionIds: appendId(state, action.meta.actionId),
          };
        }
      }

      // No goal reached — draw and advance
      const drawResult = state.deck.length > 0 ? drawCards(state.deck, 1) : { drawn: [], remaining: state.deck };
      const finalHand = drawResult.drawn.length > 0 ? [...newHand, ...drawResult.drawn] : newHand;

      const nextIdx = (state.currentPlayerIndex + 1) % state.playerOrder.length;

      // Check if deck is empty AND no one has playable cards
      const isDeckEmpty = drawResult.remaining.length === 0;
      const updatedAllHands = { ...state.hands, [pid]: finalHand };
      const updatedState = { ...state, hands: updatedAllHands, deck: drawResult.remaining };
      const stuck = isDeckEmpty && noPlayableCards(updatedState);

      return {
        ...state,
        board: newBoard,
        hands: updatedAllHands,
        deck: drawResult.remaining,
        currentPlayerIndex: nextIdx,
        lastPathPlayerId: pid,
        phase: stuck ? "round-end" : state.phase,
        goldDist: stuck ? {
          mode: "saboteurs-win",
          chooserChain: state.playerOrder.filter(p => state.roles[p] === "saboteur"),
          currentChooserIdx: 0,
          nuggetPool: [],
          saboteurPayout: getSaboteurPayout(state),
        } : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "play.action": {
      if (state.phase !== "playing") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const pid = action.meta.playerId;
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const hand = state.hands[pid];
      if (!hand) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const cardIdx = hand.findIndex(c => c.id === action.payload.cardId);
      if (cardIdx === -1) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const card = hand[cardIdx] as ActionCard;
      if (card.suit !== "action") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const { targetPlayerId, targetCol, targetRow, repairType } = action.payload;
      const newHand = removeCard(hand, card.id);

      let newBrokenTools = { ...state.brokenTools };
      let newBoard = state.board.map(r => [...r]);
      let newGoals = [...state.goalCards];
      let newDiscardPile = [...state.discardPile, { ...card }];
      let removedBrokenCards: ActionCard[] = [];

      switch (card.actionType) {
        case "break-pickaxe":
        case "break-lantern":
        case "break-wagon": {
          if (!targetPlayerId || !state.players[targetPlayerId]) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          if (targetPlayerId === pid) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          const existing = newBrokenTools[targetPlayerId] || [];
          if (existing.some(c => c.actionType === card.actionType)) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: [...existing, { ...card } as ActionCard],
          };
          break;
        }

        case "repair-pickaxe":
        case "repair-lantern":
        case "repair-wagon": {
          const repairMap: Record<string, ActionType> = {
            "repair-pickaxe": "break-pickaxe",
            "repair-lantern": "break-lantern",
            "repair-wagon": "break-wagon",
          };
          const breakType = repairMap[card.actionType];
          if (!targetPlayerId) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          const existingBroken = newBrokenTools[targetPlayerId] || [];
          const matchIdx = existingBroken.findIndex(c => c.actionType === breakType);
          if (matchIdx === -1) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          // Add the broken tool card to discard pile too
          const repairedCard = { ...existingBroken[matchIdx] };
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: existingBroken.filter((_, i) => i !== matchIdx),
          };
          removedBrokenCards = [repairedCard];
          break;
        }

        case "repair-dual": {
          if (!repairType || !targetPlayerId) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          const brkType = `break-${repairType}` as ActionType;
          const existingBrk = newBrokenTools[targetPlayerId] || [];
          const matchDualIdx = existingBrk.findIndex(c => c.actionType === brkType);
          if (matchDualIdx === -1) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          const repairedCard = { ...existingBrk[matchDualIdx] };
          newBrokenTools = {
            ...newBrokenTools,
            [targetPlayerId]: existingBrk.filter((_, i) => i !== matchDualIdx),
          };
          removedBrokenCards = [repairedCard];
          break;
        }

        case "rockfall": {
          if (targetCol === undefined || targetRow === undefined) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          const targetCell = state.board[targetRow]?.[targetCol];
          if (!targetCell) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          if (targetCol === START_COL && targetRow === START_ROW) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          if (state.goalCards.some(g => g.col === targetCol && g.row === targetRow)) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          newBoard = state.board.map(r => [...r]);
          newBoard[targetRow] = [...newBoard[targetRow]];
          newBoard[targetRow][targetCol] = null;
          // Add the removed path card to discard pile
          if (targetCell.card) {
            newDiscardPile = [...newDiscardPile, { ...targetCell.card }];
          }
          break;
        }

        case "map": {
          if (targetCol === undefined || targetRow === undefined) {
            return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          }
          const goal = newGoals.find(g => g.col === targetCol && g.row === targetRow);
          if (!goal) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
          // Reveal for this peek, then revert face-down
          newGoals = newGoals.map(g =>
            g.id === goal.id ? { ...g, revealed: true } : g
          );
          // Schedule revert: after send, the client shows the reveal briefly
          // For state-sync, we reveal and it stays revealed for this state version
          // The player can inspect the state to see the treasure
          break;
        }
      }

      // Add removed broken cards to discard pile
      if (removedBrokenCards.length > 0) {
        newDiscardPile = [...newDiscardPile, ...removedBrokenCards];
      }

      // Draw card
      const drawResult = state.deck.length > 0 ? drawCards(state.deck, 1) : { drawn: [], remaining: state.deck };
      const finalHand = drawResult.drawn.length > 0 ? [...newHand, ...drawResult.drawn] : newHand;

      const nextIdx = (state.currentPlayerIndex + 1) % state.playerOrder.length;

      const updatedAllHands = { ...state.hands, [pid]: finalHand };
      const updatedState = { ...state, hands: updatedAllHands, deck: drawResult.remaining, brokenTools: newBrokenTools, board: newBoard, goalCards: newGoals, discardPile: newDiscardPile };
      const stuck = drawResult.remaining.length === 0 && noPlayableCards(updatedState);

      return {
        ...state,
        hands: updatedAllHands,
        deck: drawResult.remaining,
        brokenTools: newBrokenTools,
        board: newBoard,
        goalCards: newGoals,
        discardPile: newDiscardPile,
        currentPlayerIndex: nextIdx,
        phase: stuck ? "round-end" : state.phase,
        goldDist: stuck ? {
          mode: "saboteurs-win",
          chooserChain: state.playerOrder.filter(p => state.roles[p] === "saboteur"),
          currentChooserIdx: 0,
          nuggetPool: [],
          saboteurPayout: getSaboteurPayout(state),
        } : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "discard.card": {
      if (state.phase !== "playing") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const pid = action.meta.playerId;
      if (state.playerOrder[state.currentPlayerIndex] !== pid) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const hand = state.hands[pid];

      // Handle empty-hand pass: if hand is empty, just advance turn (no discard)
      if (!hand || hand.length === 0) {
        const nextIdx = (state.currentPlayerIndex + 1) % state.playerOrder.length;
        const updatedState = { ...state, currentPlayerIndex: nextIdx };
        // Check if stuck is needed here too
        const deckCheck = state.deck.length === 0;
        const stuck = deckCheck && noPlayableCards(updatedState);
        return {
          ...state,
          currentPlayerIndex: nextIdx,
          phase: stuck ? "round-end" : state.phase,
          goldDist: stuck ? {
            mode: "saboteurs-win",
            chooserChain: state.playerOrder.filter(p => state.roles[p] === "saboteur"),
            currentChooserIdx: 0,
            nuggetPool: [],
            saboteurPayout: getSaboteurPayout(state),
          } : state.goldDist,
          appliedActionIds: appendId(state, action.meta.actionId),
        };
      }

      const cardIdx = hand.findIndex(c => c.id === action.payload.cardId);
      if (cardIdx === -1) return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const discarded = hand[cardIdx];
      const newHand2 = removeCard(hand, discarded.id);

      const drawResult2 = state.deck.length > 0 ? drawCards(state.deck, 1) : { drawn: [], remaining: state.deck };
      const finalHand2 = drawResult2.drawn.length > 0 ? [...newHand2, ...drawResult2.drawn] : newHand2;

      const nextIdx2 = (state.currentPlayerIndex + 1) % state.playerOrder.length;

      const updatedAllHands2 = { ...state.hands, [pid]: finalHand2 };
      const updatedState2 = { ...state, hands: updatedAllHands2, deck: drawResult2.remaining };
      const stuck = drawResult2.remaining.length === 0 && noPlayableCards(updatedState2);

      return {
        ...state,
        hands: updatedAllHands2,
        deck: drawResult2.remaining,
        discardPile: [...state.discardPile, discarded],
        currentPlayerIndex: nextIdx2,
        phase: stuck ? "round-end" : state.phase,
        goldDist: stuck ? {
          mode: "saboteurs-win",
          chooserChain: state.playerOrder.filter(p => state.roles[p] === "saboteur"),
          currentChooserIdx: 0,
          nuggetPool: [],
          saboteurPayout: getSaboteurPayout(state),
        } : state.goldDist,
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "collect.gold": {
      if (state.phase !== "round-end" || !state.goldDist) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const gd = state.goldDist;
      const currentChooser = gd.chooserChain[gd.currentChooserIdx];
      if (action.meta.playerId !== currentChooser) {
        return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };
      }

      const newNuggets = { ...state.goldNuggets };

      if (gd.mode === "miners-win") {
        // Draw from nugget pool — player picks one value
        const pool = [...gd.nuggetPool];
        const pick = pool.shift() ?? 0;
        newNuggets[currentChooser] = (newNuggets[currentChooser] || 0) + pick;
      } else {
        // Saboteur payout
        newNuggets[currentChooser] = (newNuggets[currentChooser] || 0) + gd.saboteurPayout;
      }

      if (gd.currentChooserIdx >= gd.chooserChain.length - 1) {
        return {
          ...state,
          goldNuggets: newNuggets,
          goldDist: null,
          phase: state.round >= 3 ? "game-over" as SaboteurState["phase"] : "setup" as SaboteurState["phase"],
          appliedActionIds: appendId(state, action.meta.actionId),
        };
      }

      return {
        ...state,
        goldNuggets: newNuggets,
        goldDist: {
          ...gd,
          nuggetPool: gd.mode === "miners-win" ? gd.nuggetPool.slice(1) : gd.nuggetPool,
          currentChooserIdx: gd.currentChooserIdx + 1,
        },
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "start.game": {
      // Start a new round (after round ended, manually start next round)
      if (state.phase !== "setup") return { ...state, appliedActionIds: appendId(state, action.meta.actionId) };

      const nextRound = state.round + 1;

      // Set starting player to the left of whoever played the last path card
      let startIdx = 0;
      if (state.lastPathPlayerId) {
        const lastIdx = state.playerOrder.indexOf(state.lastPathPlayerId);
        startIdx = (lastIdx + 1) % state.playerOrder.length;
      }

      // Reset board and deck
      const newBoard: (CellContent | null)[][] = Array.from({ length: BOARD_ROWS }, () =>
        Array.from({ length: BOARD_COLS }, () => null)
      );
      newBoard[START_ROW][START_COL] = { card: getStartCard(), rotation: 0 };

      const treasureIdx = Math.floor(Math.random() * 3);
      const newGoals: typeof state.goalCards = GOAL_COLS.map((col, i) => ({
        id: `goal:${nextRound}:${i}`,
        col,
        row: 0,
        isTreasure: i === treasureIdx,
        revealed: false,
        connections: [false, false, true, false],
      }));

      // Re-deal roles
      const roleCounts = getRoleCounts(state.playerOrder.length);
      const roleDeck: Role[] = [
        ...Array(roleCounts.miners).fill("miner" as Role),
        ...Array(roleCounts.saboteurs).fill("saboteur" as Role),
      ];
      // Leave one role card aside (the leftover dwarf card)
      const shuffledRoles = shuffle(roleDeck);
      const roles: Record<PlayerId, Role> = {};
      state.playerOrder.forEach((pid, i) => { roles[pid] = shuffledRoles[i]; });

      // New deck
      const deck: Card[] = shuffle(buildDeck());
      const handSize = getHandSize(state.playerOrder.length);
      const hands: Record<PlayerId, Card[]> = {};
      const { drawn, remaining } = drawCards(deck, handSize * state.playerOrder.length);
      let cardPtr = 0;
      for (const pid of state.playerOrder) {
        const h: Card[] = [];
        for (let i = 0; i < handSize; i++) {
          h.push({ ...drawn[cardPtr++] });
        }
        hands[pid] = h;
      }

      return {
        ...state,
        round: nextRound,
        board: newBoard,
        goalCards: newGoals,
        deck: remaining,
        hands,
        roles,
        brokenTools: {},
        currentPlayerIndex: startIdx,
        lastPathPlayerId: null,
        pendingAction: null,
        goldDist: null,
        phase: "playing" as SaboteurState["phase"],
        appliedActionIds: appendId(state, action.meta.actionId),
      };
    }

    case "reset.game": {
      const fresh = createInitialState();
      fresh.players = state.players;
      fresh.goldNuggets = state.goldNuggets;
      return {
        ...fresh,
        appliedActionIds: [action.meta.actionId],
      };
    }

    default:
      return state;
  }
};

// Helper to rotate connections for a played card
const rotateConnectionsForAction = (
  card: PathCard,
  rotation: 0 | 90 | 180 | 270,
): [boolean, boolean, boolean, boolean] => {
  if (rotation === 0) return [...card.connections] as [boolean, boolean, boolean, boolean];
  const shifts = rotation / 90;
  const r: [boolean, boolean, boolean, boolean] = [false, false, false, false];
  for (let i = 0; i < 4; i++) r[(i + shifts) % 4] = card.connections[i];
  return r;
};


