# 🌈 Hide & Seek - Rainbow Garden

A multiplayer 3D Hide & Seek game built with Three.js, Node.js, and Socket.IO.

## Features

✅ **3D World** - "Rainbow Garden" with low-poly trees, boxes, and obstacles  
✅ **Multiplayer** - 2-10 players per room with real-time synchronization  
✅ **Hide & Seek Gameplay** - One seeker vs multiple hiders  
✅ **Game Phases** - Lobby → Hiding (60s) → Seeking (120s)  
✅ **First-Person Camera** - WASD movement + mouse look  
✅ **Simple UI** - Room codes, timers, player list  

## Installation

### Prerequisites
- Node.js 16+
- npm

### Setup

```bash
# Clone repository
git clone https://github.com/shrunkhal45/hide-and-seek-game.git
cd hide-and-seek-game

# Install dependencies
npm install

# Run development server
npm run dev
```

This starts:
- **Backend**: http://localhost:3000
- **Frontend**: http://localhost:5173

## How to Play

1. **Open** http://localhost:5173 in your browser
2. **Enter your name** and click "Create Room" or "Join Room"
3. **Share the room code** with friends
4. Once players join, click **"Start Game"**
5. **Hiding Phase** (60s): Hiders find spots; Seeker hides
6. **Seeking Phase** (120s): Seeker hunts hiders; touch to eliminate
7. **Win Condition**: 
   - Hiders win if they survive the seeking phase
   - Seeker wins by eliminating all hiders

## Controls

| Key | Action |
|-----|--------|
| **W/A/S/D** | Move |
| **Mouse** | Look around |
| **Space** | Jump |
| **Click** | Lock cursor |
| **ESC** | Unlock cursor |

## Project Structure

```
hide-and-seek-game/
├── server.js              # Node.js + Socket.IO backend
├── vite.config.js         # Vite bundler config
├── package.json           # Dependencies
└── public/
    ├── index.html         # Main HTML
    ├── main.js            # Game entry point
    ├── networkManager.js  # Socket.IO client
    ├── inputManager.js    # Input handling
    ├── renderManager.js   # Three.js rendering
    └── gameManager.js     # Game logic
```

## Architecture

### Backend (Node.js + Socket.IO)
- Manages game rooms and player state
- Broadcasts position updates
- Handles tagging/elimination
- Manages game phases and timers

### Frontend (Three.js + Vite)
- Renders 3D world and players
- Handles user input
- Displays UI (room code, timer, player list)
- Connects to backend via WebSockets

## Network Protocol

### Client → Server
- `createRoom` - Create new game room
- `joinRoom` - Join existing room with code
- `startGame` - Begin hiding phase
- `updatePosition` - Send player position
- `tagPlayer` - Eliminate hider (seeker only)

### Server → Client
- `playerJoined` - New player in room
- `gameStarted` - Game begins with assigned seeker
- `playerMoved` - Update other player positions
- `playerEliminated` - Player was caught
- `timerUpdate` - Current countdown timer
- `phaseChanged` - Hiding → Seeking
- `gameEnded` - Game over with survivors

## Future Enhancements

- [ ] Multiple maps
- [ ] Power-ups (speed boost, invisibility)
- [ ] Chat system
- [ ] Stat tracking
- [ ] Custom player colors
- [ ] Sound effects
- [ ] Mobile support

## License

MIT
