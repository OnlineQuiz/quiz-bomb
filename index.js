// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('../..')(server);
var port = process.env.PORT || 3000;

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

// usernames which are currently connected to the chat
var usernames = {};
var numUsers = 0;

// current room
var room_id = 0;
var room_occupied = false

io.on('connection', function (socket) {
  var addedUser = false;

  console.log("socket-id: " + socket.id);
  socket.broadcast.emit('pub', socket.id);

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {

    io.to(socket.id).emit('pvt', socket.id + "data: " + data);
    console.log("pvt: " + socket.id + ", data: " + data);
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username) {

    // we store the username in the socket session for this client
    socket.username = username;
    // add the client's username to the global list
    usernames[username] = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    // remove the username from global usernames list
    if (addedUser) {
      delete usernames[socket.username];
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });

  socket.on('create_server', function () {
    room_id = Math.floor(Math.random() * 1000);
    room_occupied = true;
    socket.emit('room_id', room_id);
    socket.join(room_id.toString());
  });

  socket.on('join_server', function (server_id) {
    if (room_occupied && room_id === parseInt(server_id)) {
      socket.join(room_id.toString());
      socket.emit('joined_server', room_id)
    } else {
      socket.emit('joined_server', "failed");
    }
  });

  socket.on('room_test', function (data) {
    if (room_id) {
      io.sockets.in(room_id.toString()).emit('room_test_stoc', data);
    }
  });
});
