/*
 * API code file
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const item = require('../models/item.js');
const user = require('../models/user.js');
const secret = 'this is the secret secret secret 12356'; // same secret as in socket.js used here to sign the authentication token
//get the file with the socket api code
const socket = require('./socket.js');


/*
 * POST User sign in. User Sign in POST is treated here
 */
exports.Authenticate = (req, res) => {
  // TODO-DONE: WEEK 2 - Implement the authentication method
  console.log('Authenticate -> Received Authentication POST');

  user.findOne({ $and:[{ username: req.body.username }, { password: req.body.password }]})
    .then(User => {
      // User exists - update logged status and send response token
      if (User != null) {
        user.updateOne({ username: req.body.username }, { $set: { islogged: true, latitude: req.body.latitude, longitude: req.body.longitude } })
          .then(result => {

            if (result) {
              // user exists and status updated to islogged
              // NOTE: ORIGINAL CODE
              console.log('User is logged with due latitude and longitude');
              var token = jwt.sign(req.body, secret);
              res.json({ username: req.body.username, token: token }); 
            }

          })
          .catch(err => {
            // Error handling
            console.error('Error updating the user status', err);
            res.status(500).send('An error occurred while trying to update the user status');
          });

      } else {
        // User does not exist
        console.log('User does not exist - Unauthorized access');
        res.status(401).send('User does not exist');
      }
    })
    .catch(err => {
      // Error handling
      console.error('Error finding the user', err);
      res.status(500).send('An error occurred while trying to find the user');
    });
};
  /* Database find One example:
  user.findOne({$and:[{username: req.body.username}, {password: req.body.password}]})
    .then(User => {
      if (User != null){ //user exists update to is logged = true and send token response
        /* Database updateOne example
        user.updateOne({username: req.body.username}, {$set: {islogged: true, latitude: req.body.latitude, longitude: req.body.longitude}})
          .then(result => {
            if (result) {
             //user was updated
            })
          .catch(err => {
            // Handle the error here. For example, you might want to send an error code response to the client.
          });      
      }
       else {  
         //user does not exist
        }
    })
    .catch(err => {
      //there was an error in the database
      //send  a 5*** status using res.status   
    }); */


/*
 * POST User registration. User registration POST is treated here
 */
exports.NewUser = (req, res) => {
  // TODO-DONE: WEEK 2 - Implement the user registration method
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  // Check if username already exists
  user.findOne({ username: req.body.username })
    .then(existingUser => {

      if (existingUser != null) {
        // Username already exists
        console.log('Username already exists');
        res.status(500).send('Username already exists');

      } else {
        // Username doesnt exist - create a new user
        // FIXME: Need to add the islogged field to the user object
        user.create({
          name: req.body.name, 
          email: req.body.email, 
          username: req.body.username, 
          password: req.body.password, 
          islogged: false, 
          latitude: 0, 
          longitude: 0 })
          .then(newUser => {
            // Send new user as a JSON object to the client
            res.json(newUser);

            console.log('New User -> DB Inserted');
            
          })
          .catch(err => {
            console.error('Error creating a new user', err);
            res.status(500).send('An error occurred while trying to create a new user');
          })
      }
    })
    .catch(err => {
      console.error('Error finding the user', err);
      res.status(500).send('An error occurred while trying to find the user');
    })
};

/*user.create({ name : req.body.name, email : req.body.email, username: req.body.username, password: req.body.password, 
  islogged: false, latitude: 0,longitude: 0})
.then(newUser => {
  //created a new user here is how to send a JSON object with the user to the client
  res.json({
    name: newUser.name,
    email: newUser.email,
    username: newUser.username,
    password: newUser.password,
    latitude: newUser.latitude,
    longitude: newUser.longitude
  });
  console.log("NewUser -> DB Inserted.");
  //sends back a client user Type object (does not have the isLogged field) corresponding to the logged in user
})
.catch(err => {
  //database error occurred
});*/

  /*
  //reply with the created user in a JSON object (for now is filled with dummy values
   res.json({
    name: "somename",
    email: "some@somemail.com",
    username: "someusername",
    password: "somepassword",
    latitude: 19.09,
    longitude: 34
   });
   */



/*
 * POST Item creation. Item creation POST is treated here
 */
exports.NewItem = (req, res) => {
  // TODO-DONE: WEEK 2 - Implement the item creation method  
  console.log("NewItem -> received form submission new item");
	console.log(req.body);

  // Check if item already exists
  item.findOne({ description: req.body.description })
    .then(existingItem => {
      
      if (existingItem != null) {
        // Item already exists
        console.log('Item already exists');
        res.status(500).send('Item already exists');

      } else {
        // Item doesnt exist - create a new item
        item.create({
          description: req.body.description, 
          currentbid: req.body.currentbid, 
          remainingtime: req.body.remainingtime, 
          buynow: req.body.buynow, 
          wininguser: "", 
          sold: false, 
          owner: req.body.owner, 
          id: req.body.id })
          .then(newItem => {
            // Sends back a client item Type object 
            res.json(newItem);

            console.log('New Item -> DB Inserted');
            console.log(newItem);
            console.log('Remaining time: ', req.remainingtime);
          })
          .catch(err => {
            console.error('Error creating a new item', err);
            res.status(500).send('An error occurred while trying to create a new item');
          })
      }
    })
    .catch(err => {
      console.error('Error finding a new item', err);
      res.status(500).send('An error occurred while trying to find the item');
    })

};

//check if item already exists using the description field if not create item;
  /*   item.findOne({ * your query here * })
           .then(existingItem => {
            // existingItem is the item that was found, or null if no item was found
            if (ExistingItem != null){ //item exists
            }
            else {
                //item does not exist
                item.create({...
            }
          })
          .catch(err => {
            console.error('An error occurred:', err);
            // Handle the error here. For example, you might want to send a response to the client.
              res.status(500).send('An error occurred while trying to find the item.');
          });*/
  // send the Item as a response in the format of the Item.ts class in the client code (for now with dummy values)

  /*
  res.json({
    description: "somedescription",
    currentbid: "somecurrentbid",
    remainingtime: "someremainingtime",
    wininguser: "somewininguser"
    });
    */
   


/*
 * POST Item removal. Item removal POST is treated here
 */
exports.RemoveItem = (req, res) => {
  // TODO-DONE: WEEK 2 - Implement the item removal method
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);

  // Check if item already exists
  item.findOne({ description: req.body.description })
    .then(existingItem => {

      if (existingItem != null) {
        // Item exists - remove
        item.deleteOne({ description: req.body.description })
          .then(() => {
            console.log('Item removed successfully');
            res.status(200).send('Item removed successfully');

          })
        .catch(err => {
          console.error('An error occurred:', err);
          res.status(500).send('An error occurred while trying to remove the item');
        });

      } else {
        // Item doesn't exist - can't remove
        console.error('Item does not exist', err);
        res.status(500).send('Item does not exist');

      }
    })
    .catch(err => {
      console.error('Error creating a new item', err);
      res.status(500).send('An error occurred while trying to find the item.');
    })

};
  //check if item already exists using the description field if it exists delete it;
  /* database remove example
  item.remove({description : req.body.description})
    .then(() => {
    // The item was successfully removed
    })
    .catch(err => {
      console.error('An error occurred:', err);
      // Handle the error here. For example, you might want to send a response to the client.
      res.status(500).send('An error occurred while trying to remove the item.');
    });*/



/*
 * GET to obtain all active items in the database
 */
exports.GetItems = (req, res) => {
  // TODO-DONE: WEEK 3 - Implement the get items method

  // Find all unsol items in the database and send back to the client
  item.find({ sold: false })
    .then(Items => {

      if (Items != null && Items.length > 0) {
        // Items exist
        console.log('received get Items call responded with:', Items);
        res.json(Items);

      } else {
        // Items don't exist
        console.error('No items found');
        res.status(500).send('No items found');
      }
    })
    .catch(err => {
      // Error Handling
      console.error('Error finding the items', err);
      res.status(500).send('An error occurred while trying to find the items');
    });

};
  /*
  // Dummy items just for example you should send the items that exist in the database use find instead of findOne
  let item1 = new item({description:'Smartphone',currentbid:250, remainingtime:120, buynow:1000, wininguser:'dummyuser1'});
  let item2 = new item({description:'Tablet',currentbid:300, remainingtime:120, buynow:940, wininguser:'dummyuser2'});
  let item3 = new item({description:'Computer',currentbid:120, remainingtime:120, buynow:880, wininguser:'dummyuser3'});
  let Items = [item1,item2,item3];
  res.json(Items); //send array of existing active items in JSON notation
  console.log ("received get Items call responded with: ", Items);
  */



/*
 * GET to obtain all logged users in the database
 */
exports.GetUsers = (req, res) => {
  // TODO-DONE: WEEK 3 - Implement the get users method

  // Find all logged users in the database and send back to the client
  user.find({ islogged: true })
  .then(Users => {

    if (Users != null && Users.length > 0) {
      // Users exist
      console.log('received get Users call responded with:', Users);
      res.json(Users);

    } else {
      // Users don't exist
      console.error('No users found');
      res.status(500).send('No users found');
    }

  })
  .catch(err => {
    // Error handling
    console.error('Error finding the users', err);
    res.status(500).send('An error occurred while trying to find the users');
  });

};

//res.status(200).send('OK'); //for now it sends just a 200 Ok like if no users are logged in

