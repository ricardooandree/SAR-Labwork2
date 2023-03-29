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

  	 //create bid form
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

     // AAA -> getUsers para o googleMaps
      this.auctionservice.getUsers()
        .subscribe({
          next: result => {
          let receiveddata = result as User[]; // cast the received data as an array of items (must be sent like that from server)
            console.log("getUsers Auction Component -> received the following users: ", receiveddata);
          this.users = receiveddata;
          this.centerLat = this.signinservice.latitude;
          this.centerLong = this.signinservice.longitude;

          this.mapOptions = {
            center: { lat: this.centerLat, lng: this.centerLong },
            zoom: 10
          };
          console.log("getUsers Auction Component -> center coordinates: ", this.centerLat, this.centerLong);

          for (let user of this.users) {
            this.markers.push(new Marker( {lat: user.latitude, lng: user.longitude}, user.username));
          }
        },
        error: error => this.errorMessage = <any>error });

  //subscribe to the incoming websocket events

  //example how to subscribe to the server side regularly (each second) items:update event
      const updateItemsSubscription = this.socketservice.getEvent("update:items")
                      .subscribe(
                        data =>{
                          let receiveddata = data as Item[];
                            if (this.items){
                              this.items = receiveddata;
                            }
                        }
                      );

  //subscribe to the new item event that must be sent from the server when a client publishes a new item
    const newItemSubscription = this.socketservice.getEvent("new:item")
                      .subscribe(
                        data =>{
                          let receiveddata = data as Item;
                          if (this.items){
                            //console.log("New item: ", receiveddata);
                            let has = false;

                            for (var item of this.items) {
                              if (item.description == receiveddata.description)
                                has = true;
                            }
                            if(!has){
                              this.items.push(receiveddata);
                            }
                          }
                        }
                      );

    const removeItemSubscription = this.socketservice.getEvent("remove:item")
      .subscribe(
        data =>{
          let receiveddata = data as Item;
          if (this.items) {
            let has = false;
            let index = 0;

            for (var item of this.items) {
              index++;
              if (item.description == receiveddata.description) {
                has = true;
                this.items.splice(index, 1); // Remove from array (starting index, number of items to remove)
              }
            }
          }
        }
      );

      const receiveMessage = this.socketservice.getEvent("receive:message")
      .subscribe(
        data =>{
          let receiveddata = data as Chat;
          console.log("receive:message with data ",receiveddata); 
          if (receiveddata.receiver.localeCompare(this.userName)==0){
            this.showMessage =true; //show message pane
            this.destination = receiveddata.sender; // destination becomes the sender of the last message 
            this.chats.push(receiveddata); 
          } 

        }
      );



  //subscribe to the item sold event sent by the server for each item that ends.
    const soldItemSubscription = this.socketservice.getEvent("sold:item")
    .subscribe(
      data =>{
        let receiveddata = data as Item;
        if (this.items) {
          let has = false;
          let index = 0;

          for (var item of this.items) {
            index++;
            if (item.description == receiveddata.description) {
              has = true;
              this.items.splice(index, 1); // Remove from array (starting index, number of items to remove)
            }
          }
          if (receiveddata.wininguser == null) {
            this.message = "No bids on item: " + receiveddata.description;
          }
          else {
            this.message = receiveddata.wininguser + " won the bid for item: " + receiveddata.description;
          }
          if (this.counter<11)
          {
            this.soldHistory[this.counter++] = this.message;
          }
          else
          {
          for(let i=0; i<11; i++)
          {
            this.soldHistory[i] = this.soldHistory[i+1];
          }
          this.soldHistory[10]=this.message;
          console.log(this.soldHistory);
          }
          this.showBid = false; // makes the bid form disappear
        }
      }
    );

  //subscription to any other events must be performed here inside the ngOnInit function

  }

   logout(){
    //call the logout function in the signInService to clear the token in the browser
    this.signinservice.logout();  // Tem que estar em primeiro para ser apagado o token e nao permitir mais reconnects pelo socket
  	//perform any needed logout logic here
  	this.socketservice.disconnect();
    //navigate back to the log in page
    this.router.navigate(['/signin']);
  }

  //function called when an item is selected in the view
  onRowClicked(item: Item){
  	console.log("Selected item = ", item);
  	this.selectedItem = item;
  	this.showBid = true; // makes the bid form appear
    
    if (!item.owner.localeCompare(this.userName)) {
      this.showRemove = true;
      this.showMessage = false;
    }
    else {
      this.showRemove = false;
      this.destination = this.selectedItem.owner;
      this.showMessage = true;
    }
  }

  //function called when a received message is selected. 

  onMessageSender(ClickedChat: Chat) {

    this.destination = ClickedChat.sender; //destination is now the sender of the selected received message. 
  }

  // function called when the submit bid button is pressed
   submit(){
  	console.log("submitted bid = ", this.bidForm.value.bid);
  	//send an event using the websocket for this use the socketservice
     this.selectedItem.currentbid = this.bidForm.value.bid;
     this.selectedItem.wininguser = this.userName;
     this.socketservice.sendEvent("send:bid", this.selectedItem);
  }
  //function called when the user sends a message to the item owner
  sendMessage(){
    console.log("Message  = ", this.ChatMessage);
    let ChatMessage: Chat; 
    if (this.selectedItem) {
      ChatMessage = new Chat(this.userName,this.ChatMessage,this.selectedItem.owner);
    }
    else {
      ChatMessage = new Chat(this.userName,this.ChatMessage,this.destination);
    }
    this.socketservice.sendEvent("send:message", ChatMessage);
  }

  //function called when the cancel bid button is pressed.
   cancelBid(){
   	this.bidForm.reset(); //clears bid value
   }

   //function called when the buy now button is pressed.

   buyNow(){
   	this.bidForm.setValue({              /// sets the field value to the buy now value of the selected item
   		bid: this.selectedItem.buynow
   	});
   	this.message= this.userName + " please press the Submit Bid button to procced with the Buy now order.";
   }

  removeItem() {
     this.auctionservice.removeItem(this.selectedItem)
       .subscribe({
         next: result => {
           console.log ('remove item succcessfully',result);
           this.showBid = false; // makes the bid form disappear
         }, //callback to cath errors thrown by the Observable in the service
         error: error => {
           this.errorMessage = <any>error;
         }
        });
   }

}
