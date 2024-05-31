import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SocketService } from '../socket.service';
import { AuctionService } from '../auction.service';
import { SigninService } from '../signin.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import {Item} from '../item';
import {Chat} from '../chat';
import {User} from '../user';
import {Marker} from '../marker';


@Component({
  selector: 'app-auction',
  templateUrl: './auction.component.html',
  styleUrls: ['./auction.component.css']
})
export class AuctionComponent implements OnInit {
  items: Item[]; //array of items to store the items.
  users: User[];
  displayedColumns: string[] //Array of Strings with the table column names
  message: string; // message string
  destination : string; //string with the destination of the current message to send. 
  ChatMessage: string; // message string: string; // message string
  showBid: boolean;  //boolean to control if the show bid form is placed in the DOM
  showMessage: boolean; //boolean to control if the send message form is placed in the DOM
  selectedItem!: Item; //Selected Item
  bidForm! : FormGroup; //FormGroup for the biding
  userName!: string;
  errorMessage: string; //string to store error messages received in the interaction with the api
  mapOptions: google.maps.MapOptions;
  markers: Marker[]; //array to store the markers for the looged users posistions.
  centerLat: number;
  centerLong: number;
  showRemove: boolean;
  soldHistory: string[];
  chats: Chat[]; //array for storing chat messages
  counter: number;

  constructor( private formBuilder: FormBuilder, private router: Router, private socketservice: SocketService, private auctionservice: AuctionService,
   private signinservice: SigninService) {
    this.items = [];
    this.users = [];
    this.soldHistory = [];
    this.chats = [];
    this.counter = 0;
    this.message = "";
    this.destination ="";
    this.ChatMessage = "";
    this.showBid = false;
    this.showMessage = false;
    this.userName = this.signinservice.token.username;
    this.errorMessage = "";
    this.displayedColumns = ['description', 'currentbid', 'buynow', 'remainingtime', 'wininguser', 'owner'];
    this.centerLat = this.signinservice.latitude != null ? this.signinservice.latitude : 38.640026;
    this.centerLong = this.signinservice.longitude != null ? this.signinservice.longitude : -9.155379;
    this.markers = [];
    this.showRemove = false;
    this.mapOptions = {
      center: { lat: this.centerLat, lng: this.centerLong },
      zoom: 10
    };
  }

  ngOnInit(): void {
    this.message= "Hello " + this.userName + "! Welcome to the SAR auction site.";

    // Create bid form
    this.bidForm = this.formBuilder.group({
      bid: ['', Validators.compose([Validators.required,Validators.pattern("^[0-9]*$")])]
    });


    // Get initial item data from the server api using http call in the auctionservice
    this.auctionservice.getItems()
      .subscribe({next: result => {
        let receiveddata = result as Item[]; // cast the received data as an array of items (must be sent like that from server)
        this.items = receiveddata;
        console.log ("getItems Auction Component -> received the following items: ", receiveddata);
      },
      error: error => this.errorMessage = <any>error });


    // Get initial list of logged in users for googleMaps using http call in the auctionservice
    this.auctionservice.getUsers()
      .subscribe({
        next: result => {
        let receiveddata = result as User[]; // cast the received data as an array of items (must be sent like that from server)
        console.log("getUsers Auction Component -> received the following users: ", receiveddata);

        // TODO-DONE: WEEK 4 - Implement the logic to update the markers array with the received data
        // Update the users array and markers with the received data
        this.users = receiveddata;
        this.markers = this.users.map(user => ({
          position: { lat: user.latitude, lng: user.longitude },
          label: user.username
        }));

      },
      error: error => this.errorMessage = <any>error });


    // Subscribe to the incoming websocket events
    // NOTE: Example how to subscribe to the server side regularly (each second) items:update event
    const updateItemsSubscription = this.socketservice.getEvent("update:item")
      .subscribe(
        data =>{
          let receiveddata = data as Item[];

          // Update the items array with the received data
          if (this.items){
            this.items = receiveddata;
          }
        }
      );
    

    // TODO-DONE: WEEK 4 - Implement the subscription to the other events
    //subscribe to the new user logged in event that must be sent from the server when a client logs in 
    const newUserLoggedInSubscription = this.socketservice.getEvent("new:user")
      .subscribe(data => {
        let newUser = data as User;
        console.log('New user logged in: ', newUser);

        // Add the new user to the users array and the markers array
        this.users.push(newUser);
        this.markers.push({
          position: { lat: newUser.latitude, lng: newUser.longitude },
          label: newUser.username
        });
      });


    //subscribe to the user logged out event that must be sent from the server when a client logs out 
    const userLoggedOutSubscription = this.socketservice.getEvent("remove:user")
      .subscribe(data => {
        let loggedOutUser = data as User;
        console.log('User logged out: ', loggedOutUser);
        
        // Remove the user from the users array and the markers array
        this.users = this.users.filter(user => user.username !== loggedOutUser.username);
        this.markers = this.markers.filter(marker => marker.label !== loggedOutUser.username);
      });


    //subscribe to a receive:message event to receive message events sent by the server 
    const receiveMessageSubscription = this.socketservice.getEvent("receive:message").subscribe(data => {
      let newMessage = data as Chat;
      console.log('New message received: ', newMessage);

      // Add the new message to the chats array
      this.chats.push(newMessage);

      // Display the received message
      this.message = `New message received from ${newMessage.sender}: ${newMessage.message}`;

      // Set the destination to the sender of the received message
      this.destination = newMessage.sender;

      this.showMessage = true;
    });


    //subscribe to the item sold event sent by the server for each item that ends.
    const itemSoldSubscription = this.socketservice.getEvent("sold:item")
      .subscribe(data => {
        let soldItem = data as Item;
        console.log('Item sold: ', soldItem);

        // Add the sold item to the soldHistory array and remove it from the items array
        this.soldHistory.push(`Item ${ soldItem.description } sold to ${ soldItem.wininguser } for ${ soldItem.currentbid }`);

        this.items = this.items.filter(item => item.description !== soldItem.description);
      });


      const itemExpiredSubscription = this.socketservice.getEvent("expired:item")
      .subscribe(data => {
        let expiredItems = data as Item[];

        // Remove the expired item from the items array
        this.items = this.items.filter(item => 
          !expiredItems.some(expiredItem => expiredItem.description === item.description)
        );
      });

    //subscription to any other events must be performed here inside the ngOnInit function
  }

  
  // Function called when the user logs out
  logout(){
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
    //perform any needed logout logic here
    this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);

    // TODO: send event disconnect?
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item){
  	console.log("Selected item = ", item);
  	this.selectedItem = item;
  	this.showBid = true; // makes the bid form appear
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;

    } else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

   
  // TODO-DONE: WEEK 4 - Implement the function to handle the new user logged in event
  //function called when a received message is selected.
  onMessageSender(ClickedChat: Chat) {
    // destination is now the sender of the selected received message
    this.destination = ClickedChat.sender;
    this.showMessage = true;

    // Set the message to be sent to the selected user
    this.message = "Reply to " + this.destination + ":";
  }
  
  // TODO-DONE: WEEK 4 - Implement the place bid function
  // function called when the submit bid button is pressed
  submit(){
  	console.log("submitted bid = ", this.bidForm.value.bid);
  	//send an event using the websocket for this use the socketservice
    // example :  this.socketservice.sendEvent('eventname',eventdata);

    // Send the bid to the server using the auction service
    this.selectedItem.currentbid = this.bidForm.value.bid;
    this.selectedItem.wininguser = this.userName;
    this.socketservice.sendEvent('send:bid', this.selectedItem);
  }

  //function called when the user presses the send message button
  sendMessage() {
    console.log('Message = ', this.ChatMessage);

    // Send an event using the websocket for this use the socketservice
    this.socketservice.sendEvent('send:message', {
      sender: this.userName,
      receiver: this.destination,
      message: this.ChatMessage
    });

    this.ChatMessage = '';
  }

  //function called when the cancel bid button is pressed.
   cancelBid(){
   	this.bidForm.reset(); //clears bid value
   }

   // TODO-DONE: WEEK 4 - Implement the function to handle the buy now event
   //function called when the buy now button is pressed.
   buyNow(){
   	this.bidForm.setValue({              
      /// sets the field value to the buy now value of the selected item
   		bid: this.selectedItem.buynow
   	});

   	this.message= this.userName + " please press the Submit Bid button to procced with the Buy now order.";

     this.selectedItem.currentbid = this.bidForm.value.bid;
     this.selectedItem.wininguser = this.userName;

    // Send the buy now event to the server using the auction service
    this.socketservice.sendEvent('send:buynow', this.selectedItem);
   }

  // TODO-DONE: WEEK 4 - Implement the function to handle the user logged out event
  //function called when the remove item button is pressed.
  removeItem() {
    //use an HTTP call to the API to remove an item using the auction service.
    if (this.selectedItem) {
      this.auctionservice.removeItem(this.selectedItem).subscribe({
        next: result => {
          console.log('Item removed successfully', result);
          this.items = this.items.filter(item => item.description !== this.selectedItem.description);
        },
        error: error => {
          this.errorMessage = <any>error;
        }
      });
    } else {
      this.errorMessage = 'No item selected to remove';
    }
   }

}
