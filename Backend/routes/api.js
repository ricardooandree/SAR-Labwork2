/**
 * api code file
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
exports.Authenticate =  (req, res) =>  {
  console.log('Authenticate -> Received Authentication POST');

  user.findOne({$and:[{username: req.body.username}, {password: req.body.password}]}, (err, User) =>{
       if (err) {
        //there was an error in the database
         console.log('Authenticate -> Server Error');
         console.error(err);
         res.status(500).send("Server Error");
       }
       if (User != null){ //user exists update to is logged = true and send token response
         user.updateOne({username: req.body.username}, {$set: {islogged: true, latitude: req.body.latitude, longitude: req.body.longitude}}, (err, result) => {
           if (err) {
             console.log('Authenticate -> User Update Server Error');
             console.error(err);
             res.status(500).send("Server Error");
           }
           if (result) {

             console.log("Authenticate -> COORDINATES: ", req.body.latitude, req.body.longitude);
           }
         });

         var token = jwt.sign(req.body, secret);
         res.json({username: req.body.username, token: token});
       }
       else {   //if user not valid
         console.log("Authenticate -> Does not exist.");
         res.status(401).send('Wrong user or password');
       //user does not exist
       }
    });
};

/*
 * POST User registration. User registration POST is treated here
 */
exports.NewUser =  (req, res) => {
  console.log("NewUser -> received form submission new user");
  console.log(req.body);

  // check if username already exists
  user.findOne({username: req.body.username}, (err, ExistingUser) => {
    if (err) {
      console.log("NewUser -> Server Error");
      console.error(err);
      res.status(500).send("Server Error");
    }

    if (ExistingUser == null) {  //If it still does not exist
      //create a new user
      //database create example
      user.create({ name : req.body.name, email : req.body.email, username: req.body.username,
        password: req.body.password, islogged: false, latitude: 0, longitude: 0 } , (err, newUser) => {
        if (err) {
          //database error occurred
          console.log("NewUser -> Register error");
          console.error(err);
          res.status(500).send("Server Error");
        } else {
          //created a new user here is how to send a JSON object with the user to the client
          res.json({
            name: newUser.name,
            email: newUser.email,
            username: newUser.username,
            password: newUser.password,
            latitude: newUser.latitude,
            longidute: newUser.longitude
          });
          console.log("NewUser -> DB Inserted.");
          //res.status(200).send("OK"); //sends back ok to confirm storage
          //sends back a client user Type object (does not have the isLogged field) corresponding to the logged in user
        }
      });
    } else {  //it the user already exist reply with error
      console.log("NewUser -> Username already exists.")
      res.status(403).send('Username already exists');
    }
  })
};

/*
 * POST Item creation. Item creation POST is treated here
 */
exports.NewItem =  (req, res) => {
  console.log("NewItem -> received form submission new item");
	console.log(req.body);
  //check if item already exists using the description field if not create item;
     item.findOne({description : req.body.description}, (err, ExistingItem) =>{
            if (err) {
              //there was an error in the database
              console.log("NewItem -> Item DB register error");
              console.error(err);
              res.status(500).send("Server Error");
            }
            if (ExistingItem != null){ //item exists

              console.log("NewItem -> Item already exists.");
              res.status(403).send('An Item with the same description already exists');
            }
            else {  // AAA -> Deixamos estar o item para o caso do extra dos items vendidos
              //item does not exist
              item.create({description : req.body.description, currentbid : req.body.currentbid, remainingtime : req.body.remainingtime, buynow : req.body.buynow,
                wininguser : req.body.wininguser, sold : false, owner:req.body.owner} , (err, newItem) => {
                if (err) {
                  //database error occurred
                  console.log("NewItem -> DB register error");
                  console.error(err);
                }
                else {
                  //created a new user here is how to send a JSON object with the user to the client
                  res.json({
                    description: newItem.description,
                    currentbid: newItem.currentbid,
                    remainingtime: newItem.remainingtime,
                    buynow: newItem.buynow,
                    wininguser: newItem.wininguser,
                    owner: newItem.owner
                  });

                console.log("NewItem -> Item ", newItem, " Inserted.");
                //res.status(200).send('OK');
                //sends back a client user Type object (does not have the isLogged field) corresponding to the logged in user
                socket.NewItemBroadcast(newItem);
                }
              });
            }
       });
};

/*
 * POST Item creation. Item creation POST is treated here
 */
exports.RemoveItem =  (req, res) => {
  console.log("RemoveItem -> received form submission remove item");
  console.log(req.body);
  //check if item already exists using the description field if not create item;
  item.findOne({description : req.body.description}, (err, ExistingItem) =>{
    if (err) {
      //there was an error in the database
      console.log("RemoveItem -> Item DB register error");
      console.error(err);
      res.status(500).send("Server Error");
    }
    if (ExistingItem == null){ //item does not exist and can not be removed

      console.log("RemoveItem -> Item does not exist.");
      res.status(403).send('Item does not exist');
    }
    else {
      //item does not exist
      item.remove({description : req.body.description} , (err) => {
        if (err) {
          //database error occurred
          console.log("RemoveItem -> DB register error");
          console.error(err);
        }
        else {
          console.log("RemoveItem -> Item ", req.body.description, " Removed.");
          //res.status(200).send('OK');
          //sends back a client user Type object (does not have the isLogged field) corresponding to the logged in user
          socket.RemoveItemBroadcast(ExistingItem);
        }
      });
    }
  });
};


/*
GET to obtain all active items in the database
*/
exports.GetItems = (req, res) => {

  item.find({sold: false}, {description: 1, currentbid: 1, buynow:1, wininguser: 1, remainingtime: 1, owner: 1}).exec(function (err, items) {
    if (err) {
      //there was an error in the database
      console.log("GetItems -> DB item error");
      console.error(err);
      res.status(500).send("Server Error");

    } else if (items != null) {
      //console.log("GetItems -> received get Items call responded with: ", items);
      res.json(items); //send array of existing active items in JSON notation

    } else {
      res.status(200).send('OK');   // AAA: Nao houve erros, mas nao existem items registados na BD
    }
  });
}

exports.GetUsers = (req, res) => {

  user.find({islogged: true}, {username: 1, latitude: 1, longitude:1}).exec(function (err, users) {
    if (err) {
      //there was an error in the database
      console.log("GetUsers -> DB item error");
      console.error(err);
      res.status(500).send("Server Error");

    } else if (users != null) {
      console.log("GetUsers -> received get Users call responded with: ", users);
      res.json(users);
      // AAA -> confirmar
      //var token = jwt.sign(req.body, secret);
      //res.json({users, token: token});
    } else {
      res.status(200).send('OK');   // AAA: Nao houve erros, mas nao existem items registados na BD
    }
  });
}

