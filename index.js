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

// current rooms
var rooms = {};

io.on('connection', function (socket) {
  var addedUser = false;

  console.log("New user connected. Socket-id: " + socket.id);
  

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    console.log('\nNew message received from: ' + socket.id + '.\n Message: ' + data)
    
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

/**
* The following code is for starting the game.
* It takes as a single argument, an array of 
*     socket ids connected to the room.
*/

  function start_game(list) {
    var player_counter = 0;
    var round_num = 1;
    function ask( player_id ) {
      console.log('plid: ' + player_id)
      var player = io.sockets.connected[player_id];

      console.log('listlength: ' + list.length)
      if (list.length < 2) {
        player_id = list.pop();
        player = io.sockets.connected[player_id];
        player.emit('victory');
        console.log(list.pop() + " wins.");
        return ;
      }

      player.emit('qn', {
        'round': round_num,
        'id': 1,
        'question': "What's the colour of the sky?",
        'answer' : "blue"
      })
      console.log('qn emiited');

      player.on('ans', function (data) {
        if (player_counter >= list.length) {
            player_counter = 0;
            round_num++;
            console.log('round counter incremented.')
            console.log('plcou: ' + player_counter)
            console.log('rnum: ' + round_num)
          }
        if (data === "blue") {
          player.emit('ans_correct');
        } else {

          player.emit('ans_wrong');
          var index = list.indexOf(player_id);
          
          if (index > -1) {
            list.splice(index, 1);
            player_counter--;
          }
          console.log('ans worng. player removed: ' + player_id)
          console.log('nw list: '+ list);

        }
        ask(list[player_counter++]);
      });
      
    }

    console.log('list:' + list + ', player counter: ' + player_counter);
    ask(list[player_counter++]);

  }

/** 
* The following code is for app authentication.
* It supports users to make a new room or join existing room
* Once the admin starts the game, no new users can join that room
*/

  function app_auth() {

    socket.on('create_server', function () {
      room_id = Math.floor(Math.random() * 1000);
      socket.emit('room_id', room_id);
      socket.join(room_id.toString());
      rooms[room_id] = false;
    });

    socket.on('join_server', function (server_id) {
      if (rooms[server_id] !== undefined) {
        if (rooms[server_id]) {
          socket.emit('joined_server', "game has already started");
        } else {
          socket.join(server_id.toString());
          socket.emit('joined_server', 'Server Joined: ' + server_id.toString());
        }
      } else {
        socket.emit('joined_server', "Join Failed");
      }
    });

    socket.on('start_game', function() {
      room_to_start = socket.rooms[1];
      rooms[room_to_start] = true;
      

      var sckts = [];
      for (var skt in io.sockets.adapter.rooms[room_to_start]) {
        sckts.push(skt);
      }

      socket.emit('game_started', sckts);

      start_game(sckts);

    });

    socket.on('room_test', function (data) {
      io.sockets.in(socket.rooms[1]).emit('room_test_stoc', data);    
    });
  
  }

  app_auth();

  


});
