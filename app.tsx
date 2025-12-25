import React, { useState, useEffect } from 'react';
import { Sword, Shield, Heart, Skull, Scroll, Gift, DoorOpen, Map, X, Sparkles } from 'lucide-react';

const NorseDungeonCrawler = () => {
  const GRID_SIZE = 8;
  
  const [player, setPlayer] = useState({
    x: 0,
    y: 0,
    health: 50,
    maxHealth: 50,
    attack: 6,
    defense: 4,
    gold: 0,
    inventory: []
  });
  
  const [dungeon, setDungeon] = useState([]);
  const [explored, setExplored] = useState(new Set(['0,0']));
  const [gameLog, setGameLog] = useState(['You enter the frozen halls beneath Yggdrasil...']);
  const [combat, setCombat] = useState(null);
  const [puzzle, setPuzzle] = useState(null);
  const [gameState, setGameState] = useState('playing');
  const [notification, setNotification] = useState(null);
  
  const items = {
    healingPotion: { name: 'Healing Potion', effect: 'heal', value: 20, icon: '🧪' },
    greatHealingPotion: { name: 'Great Healing Potion', effect: 'heal', value: 40, icon: '⚗️' },
    attackRune: { name: 'Attack Rune', effect: 'attack', value: 2, icon: '⚔️' },
    defenseRune: { name: 'Defense Rune', effect: 'defense', value: 2, icon: '🛡️' },
    vikingSword: { name: 'Viking Sword', effect: 'attack', value: 3, icon: '⚔️' },
    chainmail: { name: 'Chainmail Armor', effect: 'defense', value: 3, icon: '🛡️' },
    odinsBlessing: { name: "Odin's Blessing", effect: 'maxHealth', value: 15, icon: '✨' },
    mead: { name: 'Healing Mead', effect: 'heal', value: 15, icon: '🍺' }
  };
  
  const riddles = [
    {
      question: "I have no voice, yet I speak to you. I tell of all things in the world that people do. What am I?",
      answer: "book",
      reward: "ancient tome"
    },
    {
      question: "What has roots that nobody sees, is taller than trees, up, up it goes, and yet never grows?",
      answer: "mountain",
      reward: "rune stone"
    },
    {
      question: "Voiceless it cries, wingless flutters, toothless bites, mouthless mutters. What is it?",
      answer: "wind",
      reward: "enchanted amulet"
    },
    {
      question: "In Asgard's hall, I'm known by all. One eye I gave for wisdom's call. Who am I?",
      answer: "odin",
      reward: "Odin's blessing"
    },
    {
      question: "I bind the wolf Fenrir with ease, though made of things that don't exist. What am I?",
      answer: "gleipnir",
      reward: "mythical chain"
    }
  ];
  
  const enemies = [
    { name: 'Draugr', health: 15, attack: 4, defense: 2, gold: 10 },
    { name: 'Ice Troll', health: 25, attack: 6, defense: 3, gold: 20 },
    { name: 'Frost Wolf', health: 12, attack: 5, defense: 1, gold: 8 },
    { name: 'Dark Elf', health: 18, attack: 5, defense: 3, gold: 15 },
  ];
  
  useEffect(() => {
    initializeDungeon();
  }, []);
  
  const initializeDungeon = () => {
    const newDungeon = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        if (x === 0 && y === 0) {
          row.push({ type: 'start' });
        } else if (x === GRID_SIZE - 1 && y === GRID_SIZE - 1) {
          row.push({ type: 'boss', enemy: { name: 'Frost Giant', health: 40, attack: 8, defense: 4, gold: 100 } });
        } else {
          const rand = Math.random();
          if (rand < 0.25) {
            row.push({ type: 'enemy', enemy: { ...enemies[Math.floor(Math.random() * enemies.length)] } });
          } else if (rand < 0.4) {
            row.push({ type: 'treasure' });
          } else if (rand < 0.5) {
            row.push({ type: 'item', item: getRandomItem() });
          } else if (rand < 0.6) {
            row.push({ type: 'puzzle', riddle: riddles[Math.floor(Math.random() * riddles.length)] });
          } else {
            row.push({ type: 'empty' });
          }
        }
      }
      newDungeon.push(row);
    }
    setDungeon(newDungeon);
  };
  
  const getRandomItem = () => {
    const itemKeys = Object.keys(items);
    const randomKey = itemKeys[Math.floor(Math.random() * itemKeys.length)];
    return items[randomKey];
  };
  
  const addLog = (message) => {
    setGameLog(prev => [...prev.slice(-5), message]);
  };
  
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
  };
  
  const rollDice = (sides = 6) => {
    return Math.floor(Math.random() * sides) + 1;
  };
  
  const useItem = (index) => {
    const item = player.inventory[index];
    if (!item) return;
    
    let newPlayer = { ...player };
    
    switch (item.effect) {
      case 'heal':
        newPlayer.health = Math.min(player.health + item.value, player.maxHealth);
        addLog(`Used ${item.name}! Restored ${item.value} HP.`);
        break;
      case 'attack':
        newPlayer.attack += item.value;
        addLog(`Used ${item.name}! Attack increased by ${item.value}!`);
        break;
      case 'defense':
        newPlayer.defense += item.value;
        addLog(`Used ${item.name}! Defense increased by ${item.value}!`);
        break;
      case 'maxHealth':
        newPlayer.maxHealth += item.value;
        newPlayer.health += item.value;
        addLog(`Used ${item.name}! Max health increased by ${item.value}!`);
        break;
    }
    
    newPlayer.inventory = player.inventory.filter((_, i) => i !== index);
    setPlayer(newPlayer);
  };
  
  const movePlayer = (dx, dy) => {
    if (combat || puzzle || gameState !== 'playing') return;
    
    const newX = player.x + dx;
    const newY = player.y + dy;
    
    if (newX < 0 || newX >= GRID_SIZE || newY < 0 || newY >= GRID_SIZE) {
      addLog('You cannot go that way.');
      return;
    }
    
    setPlayer(prev => ({ ...prev, x: newX, y: newY }));
    setExplored(prev => new Set([...prev, `${newX},${newY}`]));
    
    const room = dungeon[newY][newX];
    handleRoomEvent(room, newX, newY);
  };
  
  const handleRoomEvent = (room, x, y) => {
    switch (room.type) {
      case 'empty':
        addLog('An empty chamber. The air is cold.');
        break;
      case 'enemy':
        showNotification(`⚔️ A ${room.enemy.name} blocks your path!`, 'combat');
        addLog(`A ${room.enemy.name} blocks your path!`);
        setCombat({ ...room.enemy, health: room.enemy.health, maxHealth: room.enemy.health });
        break;
      case 'boss':
        showNotification('🔥 The Frost Giant rises from its throne!', 'boss');
        addLog(`The Frost Giant rises from its throne!`);
        setCombat({ ...room.enemy, health: room.enemy.health, maxHealth: room.enemy.health });
        break;
      case 'treasure':
        const gold = rollDice(20) + 10;
        setPlayer(prev => ({ ...prev, gold: prev.gold + gold }));
        showNotification(`💰 Found ${gold} gold!`, 'treasure');
        addLog(`Found ${gold} gold!`);
        dungeon[y][x].type = 'empty';
        break;
      case 'item':
        const foundItem = room.item;
        setPlayer(prev => ({ ...prev, inventory: [...prev.inventory, foundItem] }));
        showNotification(`${foundItem.icon} Found ${foundItem.name}!`, 'item');
        addLog(`Found ${foundItem.name}!`);
        dungeon[y][x].type = 'empty';
        break;
      case 'puzzle':
        showNotification('🔮 Ancient runes inscribed on the wall...', 'puzzle');
        addLog('You find ancient runes inscribed on the wall...');
        setPuzzle({ ...room.riddle, answer: room.riddle.answer.toLowerCase() });
        break;
      case 'start':
        addLog('The entrance to the dungeon.');
        break;
    }
  };
  
  const attack = () => {
    if (!combat) return;
    
    const playerRoll = rollDice();
    const playerDamage = Math.max(0, player.attack + playerRoll - combat.defense);
    
    const newEnemyHealth = combat.health - playerDamage;
    addLog(`You strike for ${playerDamage} damage! (rolled ${playerRoll})`);
    
    if (newEnemyHealth <= 0) {
      addLog(`The ${combat.name} falls! +${combat.gold} gold`);
      setPlayer(prev => ({ ...prev, gold: prev.gold + combat.gold }));
      
      if (combat.name === 'Frost Giant') {
        setGameState('won');
        showNotification('🎉 Victory! You have defeated the Frost Giant!', 'victory');
        addLog('Victory! You have defeated the Frost Giant and claimed the dungeon!');
      }
      
      const currentRoom = dungeon[player.y][player.x];
      currentRoom.type = 'empty';
      setCombat(null);
      return;
    }
    
    setCombat(prev => ({ ...prev, health: newEnemyHealth }));
    
    const enemyRoll = rollDice();
    const enemyDamage = Math.max(0, combat.attack + enemyRoll - player.defense);
    addLog(`${combat.name} strikes for ${enemyDamage} damage! (rolled ${enemyRoll})`);
    
    setPlayer(prev => {
      const newHealth = prev.health - enemyDamage;
      if (newHealth <= 0) {
        setGameState('lost');
        showNotification('💀 You have fallen in battle...', 'defeat');
        addLog('You have fallen in battle...');
      }
      return { ...prev, health: newHealth };
    });
  };
  
  const solvePuzzle = (answer) => {
    if (!puzzle) return;
    
    if (answer.toLowerCase().trim() === puzzle.answer) {
      showNotification(`✨ Correct! You receive ${puzzle.reward}!`, 'success');
      addLog(`Correct! You receive ${puzzle.reward}!`);
      setPlayer(prev => ({ 
        ...prev, 
        attack: prev.attack + 2,
        maxHealth: prev.maxHealth + 10,
        health: prev.health + 10
      }));
      const currentRoom = dungeon[player.y][player.x];
      currentRoom.type = 'empty';
      setPuzzle(null);
    } else {
      addLog('Incorrect answer. The runes fade away...');
      setPuzzle(null);
    }
  };
  
  const getRoomDisplay = (room, x, y) => {
    const isExplored = explored.has(`${x},${y}`);
    const isPlayer = player.x === x && player.y === y;
    
    if (!isExplored) {
      return { bg: 'bg-slate-950 border-slate-800', icon: null, text: '?' };
    }
    
    if (isPlayer) {
      return { bg: 'bg-green-600 border-green-400 ring-2 ring-green-300', icon: '🧙', text: '' };
    }
    
    switch (room.type) {
      case 'enemy':
        return { bg: 'bg-red-800 border-red-600', icon: '💀', text: '' };
      case 'boss':
        return { bg: 'bg-red-900 border-red-500 ring-2 ring-red-400', icon: '👹', text: '' };
      case 'treasure':
        return { bg: 'bg-yellow-700 border-yellow-500', icon: '💰', text: '' };
      case 'item':
        return { bg: 'bg-purple-700 border-purple-500', icon: '📦', text: '' };
      case 'puzzle':
        return { bg: 'bg-purple-800 border-purple-600', icon: '🔮', text: '' };
      case 'start':
        return { bg: 'bg-green-700 border-green-500', icon: '🚪', text: '' };
      case 'empty':
        return { bg: 'bg-slate-700 border-slate-600', icon: null, text: '·' };
      default:
        return { bg: 'bg-slate-700 border-slate-600', icon: null, text: '' };
    }
  };
  
  const restartGame = () => {
    setPlayer({
      x: 0,
      y: 0,
      health: 50,
      maxHealth: 50,
      attack: 6,
      defense: 4,
      gold: 0,
      inventory: []
    });
    setExplored(new Set(['0,0']));
    setGameLog(['You enter the frozen halls beneath Yggdrasil...']);
    setCombat(null);
    setPuzzle(null);
    setGameState('playing');
    setNotification(null);
    initializeDungeon();
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4 flex flex-col items-center overflow-auto">
      <div className="max-w-6xl w-full bg-slate-800 rounded-lg shadow-2xl border-4 border-blue-700 p-6 my-4">
        <h1 className="text-4xl font-bold text-center mb-4 text-blue-200 drop-shadow-lg">
          ⚔️ Norse Dungeon Crawler ⚔️
        </h1>
        
        {/* Notification Popup */}
        {notification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`bg-slate-800 rounded-lg p-6 border-4 max-w-md mx-4 ${
              notification.type === 'combat' ? 'border-red-600' :
              notification.type === 'boss' ? 'border-red-500' :
              notification.type === 'treasure' ? 'border-yellow-500' :
              notification.type === 'item' ? 'border-purple-500' :
              notification.type === 'puzzle' ? 'border-purple-600' :
              notification.type === 'victory' ? 'border-green-500' :
              notification.type === 'defeat' ? 'border-gray-600' :
              'border-blue-600'
            }`}>
              <div className="text-center">
                <p className="text-2xl text-white font-bold mb-4">{notification.message}</p>
                <button 
                  onClick={() => setNotification(null)}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Stats & Inventory */}
          <div className="space-y-4">
            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5" /> Hero Stats
              </h2>
              <div className="space-y-2 text-blue-100">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>Health: {player.health}/{player.maxHealth}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sword className="w-4 h-4 text-orange-400" />
                  <span>Attack: {player.attack}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" />
                  <span>Defense: {player.defense}</span>
                </div>
                <div className="text-yellow-400">💰 Gold: {player.gold}</div>
              </div>
            </div>
            
            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
                <Gift className="w-5 h-5" /> Inventory
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {player.inventory.length === 0 ? (
                  <p className="text-blue-200 text-sm italic">Empty</p>
                ) : (
                  player.inventory.map((item, index) => (
                    <div key={index} className="bg-slate-600 rounded p-2 flex justify-between items-center">
                      <span className="text-blue-100 text-sm">
                        {item.icon} {item.name}
                      </span>
                      <button
                        onClick={() => useItem(index)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded"
                      >
                        Use
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
              <h3 className="text-lg font-bold text-blue-300 mb-2">Movement</h3>
              <div className="grid grid-cols-3 gap-2">
                <div></div>
                <button onClick={() => movePlayer(0, -1)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">↑</button>
                <div></div>
                <button onClick={() => movePlayer(-1, 0)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">←</button>
                <div className="bg-slate-600 rounded flex items-center justify-center text-2xl">👤</div>
                <button onClick={() => movePlayer(1, 0)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">→</button>
                <div></div>
                <button onClick={() => movePlayer(0, 1)} className="bg-blue-600 hover:bg-blue-500 text-white p-3 rounded font-bold">↓</button>
                <div></div>
              </div>
            </div>
          </div>
          
          {/* Center Panel - Map */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
            <h2 className="text-xl font-bold text-blue-300 mb-3 flex items-center gap-2">
              <Map className="w-5 h-5" /> Dungeon Map
            </h2>
            <div className="grid grid-cols-8 gap-1 bg-slate-950 p-3 rounded border-2 border-slate-800">
              {dungeon.map((row, y) => 
                row.map((room, x) => {
                  const display = getRoomDisplay(room, x, y);
                  
                  return (
                    <div
                      key={`${x},${y}`}
                      className={`aspect-square flex items-center justify-center rounded text-lg font-bold border-2 ${display.bg} transition-all`}
                    >
                      {display.icon || display.text}
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 text-xs text-blue-200 grid grid-cols-2 gap-2">
              <div>🧙 You | 💀 Enemy | 👹 Boss</div>
              <div>💰 Gold | 📦 Item | 🔮 Puzzle</div>
            </div>
          </div>
          
          {/* Right Panel - Log & Actions */}
          <div className="bg-slate-700 rounded-lg p-4 border-2 border-blue-600">
            <h2 className="text-xl font-bold text-blue-300 mb-3">📜 Game Log</h2>
            <div className="bg-slate-900 rounded p-3 h-40 overflow-y-auto text-sm text-blue-100 space-y-1">
              {gameLog.map((log, i) => (
                <div key={i} className="border-b border-slate-700 pb-1">{log}</div>
              ))}
            </div>
            
            {combat && gameState === 'playing' && (
              <div className="mt-4 bg-red-900 rounded p-3 border-2 border-red-600">
                <h3 className="font-bold text-red-200 mb-2">⚔️ Combat!</h3>
                <div className="text-red-100 mb-2">
                  <div className="font-bold">{combat.name}</div>
                  <div>HP: {combat.health}/{combat.maxHealth}</div>
                  <div>ATK: {combat.attack} | DEF: {combat.defense}</div>
                </div>
                <button 
                  onClick={attack}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded"
                >
                  Attack! (Roll Dice)
                </button>
              </div>
            )}
            
            {puzzle && gameState === 'playing' && (
              <div className="mt-4 bg-purple-900 rounded p-3 border-2 border-purple-600">
                <h3 className="font-bold text-purple-200 mb-2">🔮 Riddle</h3>
                <p className="text-purple-100 text-sm mb-3">{puzzle.question}</p>
                <input
                  type="text"
                  placeholder="Your answer..."
                  className="w-full bg-slate-800 text-white p-2 rounded mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      solvePuzzle(e.target.value);
                      e.target.value = '';
                    }
                  }}
                />
                <button 
                  onClick={(e) => {
                    const input = e.target.previousElementSibling;
                    solvePuzzle(input.value);
                    input.value = '';
                  }}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded"
                >
                  Submit Answer
                </button>
              </div>
            )}
            
            {gameState === 'won' && (
              <div className="mt-4 bg-green-900 rounded p-4 border-2 border-green-600 text-center">
                <h3 className="font-bold text-green-200 text-xl mb-2">🎉 Victory! 🎉</h3>
                <p className="text-green-100 mb-3">You have conquered the dungeon!</p>
                <button 
                  onClick={restartGame}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded"
                >
                  Play Again
                </button>
              </div>
            )}
            
            {gameState === 'lost' && (
              <div className="mt-4 bg-gray-900 rounded p-4 border-2 border-gray-600 text-center">
                <h3 className="font-bold text-gray-200 text-xl mb-2">💀 Defeated 💀</h3>
                <p className="text-gray-300 mb-3">Your journey ends here...</p>
                <button 
                  onClick={restartGame}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-4 text-center text-blue-300 text-sm">
          <p>🎲 Combat uses dice rolls! Higher rolls deal more damage.</p>
          <p>🔮 Solve riddles for permanent stat boosts. 📦 Collect items to aid your journey!</p>
          <p>⚔️ Defeat the Frost Giant to win!</p>
        </div>
      </div>
    </div>
  );
};

export default NorseDungeonCrawler;
