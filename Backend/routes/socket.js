/**
 * API code file
 */
const jwt = require('jsonwebtoken'); //to deal with authentication based in tokens 
const user = require('../models/user.js'); //database use model
const item = require('../models/item.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in api.js used here to verify the authentication token

var socketIDbyUsername = new Map(); // map to store clients the client object with username has key
var usernamebySocketID = new Map(); // map to store clients the client object with socketid has key
var ioSocket = null; // global store object for websocket


/*
 * Timer function to decrement the remaining time in the items of the database with auctionTime bigger than 0
 */
var IntervalId = setInterval(function () {
  // TODO-DONE: WEEK 3/4 - Implement timer function 

  // Updating all active items with -1 auctionTime
   item.updateMany({ remainingtime: { $gt: 0 } }, { $inc: { remainingtime: -1 } }, { multi: true })
    .then(() => {
      // Find all unsold items (remaining time > 0 and not sold) and send them to all clients via websocket
      item.find({ remainingtime: { $gt: 0 }, sold: false })
        .then((unsoldItems) => {

          // If there's unsold items, send them to all clients
          if (unsoldItems.length > 0) {

            console.log('Unsold items: ', unsoldItems);

            // Send items to all clients
            if (ioSocket != null) { 
              for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
                ioSocket.to(socketID).emit('update:item', unsoldItems);
              }
            }
            // Debug message
            console.log('Unsold items sent to all clients');
          }
        })
        .catch(err => {
          console.error('Error finding unsold items', err);
        });
      
      // Find all expired items (remaining time < 1  and not sold) and update the sold status to true
      item.find({ remainingtime: { $lt: 1 }, sold: false })
        .then((expiredItems) => {
          // If there's expired items send them to all clients
          if (expiredItems.length > 0) {

            console.log('Expired items: ', expiredItems);

            // Update sold status to true for expired items
            item.updateMany({ remainingtime: { $lt: 1 }, sold: false }, { $set: { sold: true } }, { multi: true })
              .then(() => {

                // Check if there's any item with a wining user
                let itemsWithWiningUser = expiredItems.filter(item => item.wininguser != null && item.wininguser !== "");
                
                if (ioSocket != null) { 
                  if (itemsWithWiningUser.length > 0) {
                    // Send each sold item to all clients
                    for (var socketID of socketIDbyUsername.values()) {
                      itemsWithWiningUser.forEach(soldItem => {
                        ioSocket.to(socketID).emit('sold:item', soldItem);
                      });
                    }
                    
                  } else {
                    // Send expired item to all clients
                    for (var socketID of socketIDbyUsername.values()) {
                      ioSocket.to(socketID).emit('expired:item', expiredItems);
                    }
                  }
                }
              })
              .catch(err => {
                console.error('Error updating sold status', err);
              });
          }
        })
        .catch(err => {
          console.error('Error finding expired items', err);
        });

    })
    .catch(err => {
      console.error('Error updating items', err);
    });

  }, 1000); // 1000 miliseconds is the interval time 


/*
 * Broadcasts an event to to all logged clients with the new LoggedIn client
 */
exports.NewLoggedUserBroadcast = function (newUser) {

  console.log('NewUserBroadcast -> ', newUser);
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

      for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
          ioSocket.to(socketID).emit('new:user', newUser);
      }
  }
}

/*
// NOTE: SEND TO THE CLIENT THAT LOGGED IN THE LIST OF ALL LOGGED USERS WITH COORDINATES
// socket.emit(EVENTO, DATA)
*/

/*
 * Broadcasts an event to to all logged clients with the new LoggedOut client
 */
exports.UserLoggedOutBroadcast = function (loggedOutUser) {

  console.log('UserLoggedOutBroadcast -> ', loggedOutUser);
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
      ioSocket.to(socketID).emit('remove:user', loggedOutUser);
    }
  }
}


/*
 * Export function for listening to the socket
 */
exports.StartSocket = (io) => {
    ioSocket = io; // Store socket object for use in interval (timer) function
    
    // Set up jwt authentication in the socket
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

    // Debug message
    console.log('Socket Started!');

    // TODO-DONE: WEEK 3 - Implement event handling for socket.io
    // Event handling - when a client connects
    io.on('connection', (socket) => {  // First time it is called is when the client connects sucessfully

        console.log(socket.decoded_token.username, 'user connected'); // Shows username in the valid token sent by client

        // Store client in the socketIDbyUsername map the id of the socket is obtainable in the socket object : socket.id
        socketIDbyUsername.set(socket.decoded_token.username, socket.id);
        
        // Store client in the usernamebySocketID map the username can be obtained in the decoded_token "socket.decoded_token.username"
        usernamebySocketID.set(socket.id, socket.decoded_token.username);


        // defintion and handling of events:
        // new user event sent by client serves as an example of websocket communication between server and client.
        // it is the only one that is being sent by the client in this initial project
        socket.on('newUser:username', data => {
            console.log("newUser:username -> New user event received: ", data);

            // Broadcast the new user to all clients and send to the logged in user the list of all logged users
            exports.NewLoggedUserBroadcast(data);
        });


        //event to receive bids, server is not yet sending this event. 
        socket.on('send:bid', data => {
          console.log("send:bid -> Received event send:bid with data = ", data);
          
          // Verify in the database if the data.bid is higher than the current one and if so update the object
          item.findOne({ description: data.description })
            .then(itemFound => {
              console.log('Item found: ', itemFound);

              if (itemFound != null && data.currentbid > itemFound.currentbid) {
                item.updateOne({ description: itemFound.description }, { $set: { currentbid: data.currentbid, wininguser: data.wininguser } })
                  .then(() => {
                    console.log('Item updated with new bid');
                  })
                  .catch(err => {
                    console.error('Error updating item with new bid', err);
                  });
              }
            })
            .catch(err => {
              console.error('Error finding item', err);
            });

        });

        //event to receive messages and relay to destination, server is not yet sending this event. 
        socket.on('send:message', chat => {
          console.log("send:message received with -> ", chat);
      
          let destinationSocketID = socketIDbyUsername.get(chat.receiver);
          if (destinationSocketID != null) {
            ioSocket.to(destinationSocketID).emit('receive:message', chat);

          } else {
            console.log('Destination user not found or not connected: ', chat.receiver);
          }
        });

        socket.on('send:buynow', data => {
          console.log("send:buynow -> Received event send:buynow with data = ", data);
          
          // Verify in the database if the data.bid is higher than the current one and if so update the object
          item.findOne({ description: data.description })
            .then(itemFound => {
              console.log('Item found: ', itemFound);

              if (itemFound != null) {
                item.updateOne({ description: itemFound.description }, { $set: { currentbid: data.currentbid, wininguser: data.wininguser, remainingtime: 0 } })
                  .then(() => {
                    console.log('Item updated with buy now - sold');
                  })
                  .catch(err => {
                    console.error('Error updating item with buy now', err);
                  });
              }
            })
            .catch(err => {
              console.error('Error finding item', err);
            });
        });

        //Any other events that you wanto to add that are sent by the client to the server should be coded here you can use the Maps
        //to answer to all clients or the socket.emit method to reply to the same client that sent the received event.

        //when a user leaves this event is executed cleanup what you need here for example update user database
        socket.on('disconnect', function () {

          let username = usernamebySocketID.get(socket.id); // Get username from socketId in the Map
          console.log('User disconnected: ', username);

          // Update user logged status 
          user.updateOne({ username: username }, { $set: { islogged: false } })
            .then(() => {
              console.log('User logged status updated');
            })
            .catch(err => {
              console.error('Error updating user logged status', err);
            });

          // Remove user from hash maps
          socketIDbyUsername.delete(socket.id);
          usernamebySocketID.delete(username);

          // Broadcast the user that logged out
          exports.UserLoggedOutBroadcast(username);
        });
    });

}
