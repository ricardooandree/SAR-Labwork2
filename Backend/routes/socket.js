/**
 * api code file
 */

const jwt = require('jsonwebtoken'); //to deal with authentication based in tokens 
const user = require('../models/user.js'); //database use model
const item = require('../models/item.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in api.js used here to verify the authentication token

var socketIDbyUsername = new Map(); // map to store clients the client object with username has key
var usernamebySocketID = new Map(); // map to store clients the client object with socketid has key
var ioSocket = null; // global store object for websocket

//timer function to decrement the remaining time in the items of the database with auctionTime bigger than 0.
var IntervalId = setInterval(function () {
  /*start by udpating all active items with -1 auctionTime you can use the method  
   item.updateMany({remainingtime: {$gt:0}},{$inc:{remainingtime: -1}},{multi:true})
  //after decrementing all items, use find to get all unsold items and send them to all clients via websocket
  //obtain all items that are less than 0 and not marked as sold yet using the item.find method that returns all those items 
  //uptade the sold property and send the sold items to all clients 
      /* the following method sends an event for a specific socket id you can call in a cycle to send to all socket ids. 
       ioSocket.to(id).emit('sold:item', {  // send a sold event for each item
       //fill with object to send in JSON
       });*/
  //update times
  }, 1000); // 1000 miliseconds is the interval time 

/*broadcasts an event to to all logged clients with the new LoggedIn client
 */
exports.NewLoggedUserBroadcast = function (newUser) {

  //console.log('NewItemBroadcast -> ', newItem);
    if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

        for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
            ioSocket.to(socketID).emit('new:item', newUser);
        }
    }
}
/*broadcasts an event to to all logged clients with the new LoggedOut client
 */
exports.UserLoggedOutBroadcast = function (loggedOutUser) {

  console.log('RemoveItemBroadcast -> ', loggedOutUser);
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
      ioSocket.to(socketID).emit('remove:item', loggedOutUser);
    }
  }
}

// export function for listening to the socket
exports.StartSocket = (io) => {

    ioSocket = io; // store socket object for use in interval (timer) function
    
    io.use((socket, next) => {
        if (socket.handshake.query && socket.handshake.query.token) {
            jwt.verify(socket.handshake.query.token, secret, function (err, decoded) {
                if (err) return next(new Error('Authentication error'));
                socket.decoded_token = decoded;
                next();
            });
        } else {
            next(new Error('Authentication error'));
        }
    });

    //set up jwt authentication in the socket
    io.use((socket, next) => {
      if (socket.handshake.query && socket.handshake.query.token){
        jwt.verify(socket.handshake.query.token, secret, function(err, decoded) {
          if(err) return next(new Error('Authentication error'));
          socket.decoded_token = decoded;
          next();
        });
      } else {
        next(new Error('Authentication error'));
      }
    });

    console.log('Socket Started!');
    io.on('connection', (socket) => {  // first time it is called is when the client connects sucessfully

        console.log(socket.decoded_token.username, 'user connected'); // shows username in the valid token sent by client
        // store client in the socketIDbyUsername map the id of the socket is obtainable in the socket object : socket.id 
        // store client in the usernamebySocketID map the username can be obtained in the decoded_token "socket.decoded_token.username"
        // defintion and handling of events:

        //new user event sent by client serves as an example of websocket communication between server and client.
        //it is the only one that is being sent by the client in this initial project
        socket.on('newUser:username', data => {
            console.log("newUser:username -> New user event received: ", data);
        });
        //event to receive bids, server is not yet sending this event. 
        socket.on('send:bid', data => {
            console.log("send:bid -> Received event send:bid with data = ", data);
            //verify in the database if the data.bid is higher than the current one and if so update the object
            //the the items are sent every second in the interval method so all clients will receive the updated info in the next second.
        });
        //event to receive messages and relay to destination, server is not yet sending this event. 
        socket.on('send:message', chat => {
          console.log("send:message received with -> ", chat);
        });

        //Any other events that you wanto to add that are sent by the client to the server should be coded here you can use the Maps
        //to answer to all clients or the socket.emit method to reply to the same client that sent the received event.

        //when a user leaves this event is executed cleanup what you need here for example update user database
        socket.on('disconnect', function () {
          console.log("User disconnected");
          let username = usernamebySocketID.get(socket.id); // get username from socketId in the Map
            //update user status with looged in false
        });
    });

}
