// server/tests/matchmaking/manual-test.js
import { io } from 'socket.io-client';
import readline from 'readline';
import jwt from 'jsonwebtoken';
import chalk from 'chalk';

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'your-dev-secret-key';

// Create test tokens
const createToken = (userId, username) => {
  return jwt.sign(
    { userId, username }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
  );
};

// Socket clients
const clients = new Map();

/**
 * Connect a test client with a given user
 */
const connectClient = (userId, username) => {
  console.log(chalk.yellow(`Connecting as ${username} (${userId})...`));
  
  const token = createToken(userId, username);
  const socket = io(SERVER_URL, {
    auth: { token },
    transports: ['websocket']
  });
  
  socket.on('connect', () => {
    console.log(chalk.green(`✓ Connected as ${username}`));
    clients.set(userId, { socket, username });
    
    // Setup event listeners
    setupEventListeners(socket, userId, username);
  });
  
  socket.on('connect_error', (error) => {
    console.error(chalk.red(`Connection error for ${username}:`, error.message));
  });
  
  socket.on('disconnect', () => {
    console.log(chalk.yellow(`Disconnected: ${username}`));
  });
  
  return socket;
};

/**
 * Setup event listeners for a socket
 */
const setupEventListeners = (socket, userId, username) => {
  // Listen for matchmaking events
  socket.on('matchmaking_queue_update', (stats) => {
    console.log(chalk.blue(`Queue Update for ${username}:`));
    console.log(`  Players in queue: ${stats.playersInQueue}`);
    console.log(`  Average wait time: ${stats.averageWaitTime}s`);
    console.log('  Elo distribution:');
    Object.entries(stats.eloDistribution).forEach(([range, count]) => {
      if (count > 0) {
        console.log(`    ${range}: ${count} players`);
      }
    });
  });
  
  socket.on('match_found', (matchData) => {
    console.log(chalk.green(`Match found for ${username}!`));
    console.log(`  Game ID: ${matchData.gameId}`);
    console.log(`  Role: ${matchData.role}`);
    console.log(`  Opponent ID: ${matchData.opponent.id}`);
    console.log(`  Opponent Elo: ${matchData.opponent.eloRating}`);
    console.log(`  Your Elo: ${matchData.yourElo}`);
  });
  
  socket.on('game_started', (gameData) => {
    console.log(chalk.green(`Game started for ${username}!`));
    console.log(`  Game ID: ${gameData.gameId}`);
    console.log(`  White: ${gameData.whitePlayerId}`);
    console.log(`  Black: ${gameData.blackPlayerId}`);
  });
};

/**
 * Display the main menu
 */
const showMainMenu = () => {
  console.log(chalk.cyan('\n=== Matchmaking Test Menu ==='));
  console.log('1. Connect a test client');
  console.log('2. Show connected clients');
  console.log('3. Join matchmaking queue');
  console.log('4. Leave matchmaking queue');
  console.log('5. Get matchmaking stats');
  console.log('6. Disconnect a client');
  console.log('7. Exit');
  
  rl.question(chalk.cyan('\nChoose an option: '), handleMenuChoice);
};

/**
 * Handle menu selection
 */
const handleMenuChoice = (choice) => {
  switch (choice) {
    case '1':
      addTestClient();
      break;
    case '2':
      showConnectedClients();
      break;
    case '3':
      joinMatchmakingQueue();
      break;
    case '4':
      leaveMatchmakingQueue();
      break;
    case '5':
      getMatchmakingStats();
      break;
    case '6':
      disconnectClient();
      break;
    case '7':
      exitProgram();
      break;
    default:
      console.log(chalk.red('Invalid option.'));
      showMainMenu();
  }
};

/**
 * Add a new test client
 */
const addTestClient = () => {
  rl.question('Enter user ID (e.g., user1): ', (userId) => {
    rl.question('Enter username (e.g., Player1): ', (username) => {
      connectClient(userId, username);
      showMainMenu();
    });
  });
};

/**
 * Show all connected clients
 */
const showConnectedClients = () => {
  console.log(chalk.cyan('\nConnected Clients:'));
  if (clients.size === 0) {
    console.log('No clients connected.');
  } else {
    let index = 1;
    clients.forEach(({ username }, userId) => {
      console.log(`${index++}. ${username} (${userId})`);
    });
  }
  showMainMenu();
};

/**
 * Join matchmaking queue with a client
 */
const joinMatchmakingQueue = () => {
  if (clients.size === 0) {
    console.log(chalk.red('No clients connected. Connect a client first.'));
    return showMainMenu();
  }
  
  selectClient((userId, { socket, username }) => {
    console.log(chalk.yellow(`Adding ${username} to matchmaking queue...`));
    
    socket.emit('join_matchmaking_queue', {}, (response) => {
      if (response.success) {
        console.log(chalk.green(`✓ Added ${username} to matchmaking queue.`));
        if (response.match) {
          console.log(chalk.green(`Found immediate match! Game ID: ${response.match.gameId}`));
        }
      } else {
        console.log(chalk.red(`Failed to add ${username} to queue: ${response.error}`));
      }
      showMainMenu();
    });
  });
};

/**
 * Leave matchmaking queue with a client
 */
const leaveMatchmakingQueue = () => {
  if (clients.size === 0) {
    console.log(chalk.red('No clients connected. Connect a client first.'));
    return showMainMenu();
  }
  
  selectClient((userId, { socket, username }) => {
    console.log(chalk.yellow(`Removing ${username} from matchmaking queue...`));
    
    socket.emit('leave_matchmaking_queue', {}, (response) => {
      if (response.success) {
        if (response.removed) {
          console.log(chalk.green(`✓ Removed ${username} from matchmaking queue.`));
        } else {
          console.log(chalk.yellow(`${username} was not in the queue.`));
        }
      } else {
        console.log(chalk.red(`Failed to remove ${username} from queue: ${response.error}`));
      }
      showMainMenu();
    });
  });
};

/**
 * Get matchmaking stats with a client
 */
const getMatchmakingStats = () => {
  if (clients.size === 0) {
    console.log(chalk.red('No clients connected. Connect a client first.'));
    return showMainMenu();
  }
  
  selectClient((userId, { socket, username }) => {
    console.log(chalk.yellow(`Getting matchmaking stats as ${username}...`));
    
    socket.emit('get_matchmaking_stats', {}, (response) => {
      if (response.success) {
        console.log(chalk.green('Matchmaking Stats:'));
        console.log(`  Players in queue: ${response.stats.playersInQueue}`);
        console.log(`  Average wait time: ${response.stats.averageWaitTime}s`);
        console.log('  Elo distribution:');
        Object.entries(response.stats.eloDistribution).forEach(([range, count]) => {
          if (count > 0) {
            console.log(`    ${range}: ${count} players`);
          }
        });
      } else {
        console.log(chalk.red(`Failed to get stats: ${response.error}`));
      }
      showMainMenu();
    });
  });
};

/**
 * Disconnect a client
 */
const disconnectClient = () => {
  if (clients.size === 0) {
    console.log(chalk.red('No clients connected.'));
    return showMainMenu();
  }
  
  selectClient((userId, { socket, username }) => {
    console.log(chalk.yellow(`Disconnecting ${username}...`));
    socket.disconnect();
    clients.delete(userId);
    console.log(chalk.green(`✓ Disconnected ${username}`));
    showMainMenu();
  });
};

/**
 * Select a client from the connected clients
 */
const selectClient = (callback) => {
  console.log(chalk.cyan('\nSelect a client:'));
  const clientList = Array.from(clients.entries());
  
  clientList.forEach(([userId, { username }], index) => {
    console.log(`${index + 1}. ${username} (${userId})`);
  });
  
  rl.question('Enter client number: ', (choice) => {
    const index = parseInt(choice) - 1;
    if (index >= 0 && index < clientList.length) {
      const [userId, client] = clientList[index];
      callback(userId, client);
    } else {
      console.log(chalk.red('Invalid selection.'));
      showMainMenu();
    }
  });
};

/**
 * Exit the program
 */
const exitProgram = () => {
  console.log(chalk.yellow('Disconnecting all clients...'));
  clients.forEach(({ socket }) => socket.disconnect());
  console.log(chalk.green('All clients disconnected.'));
  rl.close();
  process.exit(0);
};

// Start the application
console.log(chalk.cyan('=== Matchmaking Test Tool ==='));
console.log(`Server URL: ${SERVER_URL}`);
console.log('This tool helps test the matchmaking system interactively.\n');

showMainMenu();

// Handle CTRL+C
process.on('SIGINT', () => {
  exitProgram();
});
