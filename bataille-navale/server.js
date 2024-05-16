const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinGame', () => {
        console.log(`${socket.id} joined the game`);
        players[socket.id] = {
            opponent: null,
            ready: false,
            board: Array(10).fill().map(() => Array(10).fill(0)),
            hits: 0,
        };

        let availablePlayer = Object.keys(players).find(playerId => players[playerId].opponent === null && playerId !== socket.id);
        if (availablePlayer) {
            players[socket.id].opponent = availablePlayer;
            players[availablePlayer].opponent = socket.id;

            io.to(socket.id).emit('gameStart', { opponentId: availablePlayer });
            io.to(availablePlayer).emit('gameStart', { opponentId: socket.id });
            console.log(`${socket.id} and ${availablePlayer} are now opponents`);
        }
    });

    socket.on('placeShips', (board) => {
        console.log(`${socket.id} placed ships`);
        players[socket.id].board = board;
        players[socket.id].ready = true;

        let opponentId = players[socket.id].opponent;
        if (players[opponentId] && players[opponentId].ready) {
            io.to(socket.id).emit('bothReady');
            io.to(opponentId).emit('bothReady');
            console.log(`${socket.id} and ${opponentId} are both ready`);
        }
    });

    socket.on('makeMove', (x, y) => {
        console.log(`${socket.id} made a move at (${x}, ${y})`);
        let opponentId = players[socket.id].opponent;
        if (!opponentId) return;

        let opponentBoard = players[opponentId].board;
        let hit = opponentBoard[x][y] === 1;
        if (hit) {
            players[socket.id].hits += 1;
            opponentBoard[x][y] = 2;  // 2 = hit
        } else {
            opponentBoard[x][y] = 3;  // 3 = miss
        }

        io.to(socket.id).emit('moveResult', { x, y, hit });
        io.to(opponentId).emit('opponentMove', { x, y, hit });

        if (players[socket.id].hits === 5) {  // Assuming each player has 5 ships
            io.to(socket.id).emit('gameOver', 'win');
            io.to(opponentId).emit('gameOver', 'lose');
            console.log(`${socket.id} won the game`);
        }
    });

    socket.on('disconnect', () => {
        let opponentId = players[socket.id] ? players[socket.id].opponent : null;
        if (opponentId) {
            io.to(opponentId).emit('opponentDisconnected');
            players[opponentId].opponent = null;
        }
        delete players[socket.id];
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
