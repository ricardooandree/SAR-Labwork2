/**
 * api code file
 */

const socketioJwt = require('socketio-jwt'); //to deal with authentication based in tokens -  WebSocket
const user = require('../models/user.js'); //database use model
const item = require('../models/item.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in api.js used here to verify the authentication token

var socketIDbyUsername = new Map(); // map to store clients the client object with username has key
var usernamebySocketID = new Map(); // map to store clients the client object with socketid has key
var ioSocket = null; // global store object for websocket

//timer function to decrement the remaining time in the items of the database with auctionTime bigger than 0.
var IntervalId = setInterval(function () {
//start by udpating all active items with -1 auctionTime you can use the method
  item.updateMany({remainingtime: {$gt: 0}}, {$inc: {remainingtime: -1}}, {multi: true}, (err, results) => {
    if (err) {
      console.log("setInterval -> updateMany Server Error");
      console.error(err);
    }
  });
//after decrementing all items, use find to get all unsold items and send them to all clients via websocket
//obtain all items that are less than 0 and not marked as sold yet using the item.find method that returns all those items

  // Send to all users the updated unsold items
  item.find({sold: false, remainingtime: {$gt: 1}}, {description: 1, currentbid: 1, buynow: 1, wininguser: 1, remainingtime: 1, owner: 1},  (err, items) => {
    if (err) {
      //there was an error in the database
      console.log("setInterval -> find Server Error");
      console.error(err);
    }
    else if (items != null) {
      for (var socketID of socketIDbyUsername.values()) {
        ioSocket.to(socketID).emit('update:items', items);
      }
    }
  });

  // AAA -> Items ainda nao vendidos mas que o tempo ja chegou a 0
  item.find({$and: [{sold: false}, {remainingtime: {$lt: 1}}]}, {description: 1, currentbid: 1, buynow: 1, remainingtime: 1, wininguser: 1, owner: 1}, (err, availableItems) => {
    if (availableItems != null) {
      for (var soldItem of availableItems) {
        //if (!soldItem.sold) {
          item.updateOne({description: soldItem.description}, {$set: {sold: true}}, (err) => {
            if (err) {
              console.log("setInterval -> updateOne Server Error");
              console.error(err);
            }});
          if (soldItem.wininguser == null) {
            console.log("setInterval -> Item without any bid: ", soldItem.description);
          } else {
            console.log("setInterval -> Item ", soldItem.description, " to ", soldItem.wininguser);
          }
          for (var socketID of socketIDbyUsername.values()) {
            ioSocket.to(socketID).emit('sold:item', soldItem);
            console.log("setInterval -> Event sent of sold:item.");
          }
        //}
      }
    }
  });
}, 1000); // 1000 miliseconds is the interval time


/*broadcasts a new item to all logged clients exported so that it can be called from the index.js module after receiving POST for
 new item
 */
exports.NewItemBroadcast = function (newItem) {

  //console.log('NewItemBroadcast -> ', newItem);
    if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

        for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
            ioSocket.to(socketID).emit('new:item', newItem);
        }
    }
}

exports.RemoveItemBroadcast = function (removedItem) {

  console.log('RemoveItemBroadcast -> ', removedItem);
  if (ioSocket != null) {  // test if the socket was already created (at least one client already connected the websocket)

    for (var socketID of socketIDbyUsername.values()) { // for all clients call the emit method for each socket id to send the new:item method
      ioSocket.to(socketID).emit('remove:item', removedItem);
    }
  }
}

// export function for listening to the socket
exports.StartSocket = (io) => {

    ioSocket = io; // store socket object for use in interval (timer) function

    io.use(socketioJwt.authorize({
        secret: secret,
        handshake: true
    }));
    console.log('Socket Started!');
    io.on('connection', (socket) => {  // first time it is called is when the client connects sucessfully

        console.log(socket.decoded_token.username, 'user connected'); // shows username in the valid token sent by client
        socketIDbyUsername.set(socket.decoded_token.username, socket.id);
        usernamebySocketID.set(socket.id, socket.decoded_token.username);
        // defintion and handling of events:

        //new user event sent by client
        socket.on('newUser:username', data => {
            // store client in the socketIDbyUsername map the id of the socket is obtainable in the socket object : socket.id
            // store client in the usernamebySocketID map the username is received in the data object.
            //you can use the .set method in the Maps
            socketIDbyUsername.set(data.username, socket.id);
            usernamebySocketID.set(socket.id, data.username);
            console.log("newUser:username -> New user event received: ", data);
        });

        socket.on('send:bid', data => {
            //AAA -> data[0] = Nova bid; data[1] = Item escolhido com os seus dados
            console.log("send:bid -> Received event send:bid with data = ", data);
            //verify in the database if the data.bid is higher than the current one and if so update the object

            item.findOne({$and:[{description: data.description}, {sold: false}]}, (err, ExistingItem) =>{
              if (err) {
                //there was an error in the database
                console.log("send:bid -> DB register error");
                console.error(err);
              }
              if (ExistingItem == null){ //item exists
                console.log("send:bid -> Item does not exist.");
              }
              else {
                if (data.currentbid >= ExistingItem.buynow) {
                  console.log("send:bid -> Successfull buy", ExistingItem);
                  item.updateOne({$and: [{description: ExistingItem.description}, {sold: false}]}, {$set: {remainingtime: 1, wininguser: data.wininguser}}, (err, results) => {
                    if (err) {
                      console.log("send:bid -> Cannot update item");
                      console.error(err);
                    }
                  });
                }
                else if(data.currentbid > ExistingItem.currentbid || (data.currentbid == ExistingItem.currentbid && ExistingItem.wininguser==null)) {
                  console.log("send:bid -> Successfull bid", ExistingItem);
                  item.updateOne({$and: [{description: ExistingItem.description}, {sold: false}]}, {$set: {currentbid: data.currentbid, wininguser: data.wininguser}}, (err, results) => {
                    if (err) {
                      console.log("send:bid -> Cannot update item");
                      console.error(err);
                    }
                  });
                }
              }
            });
              //the the items are sent every second in the interval method so all clients will receive the updated info in the next second.
        });

        socket.on('send:message', chat => {
          console.log("send:message received with -> ", chat);
          ioSocket.to(socketIDbyUsername.get(chat.receiver)).emit('receive:message', chat);
          console.log ("receive:message sent to ", socketIDbyUsername.get(chat.receiver))
        });

        //Any other events that you wanto to add that are sent by the client to the server should be coded here you can use the Maps
        //to answer to all clients or the socket.emit method to reply to the same client that sent the received event.

        //when a user leaves this event is executed cleanup what you need here for example update user database
        socket.on('disconnect', function () {
            let username = usernamebySocketID.get(socket.id); // get username from socketId in the Map
            //update user status with looged in false
           user.updateOne({username: username}, {$set: {islogged: false}}, (err, result) => {
                if (err) {
                    console.error(err);
                }
                if (result) {
                    console.log("disconnect -> ", username, " disconnected");
                }

            });
        });
    });

}
