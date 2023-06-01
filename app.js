//Imports Node js packages 
require('dotenv').config();
const express = require("express");
const bodyParser = require("body-parser");
const request = require("request");
const https = require("https");
const mongoose = require("mongoose");
const stripe = require("stripe")(process.env.STRIPE_KEY);
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

//Set up express with Node js
const app = express();
//Sets view engine to ejs
app.set("view engine", "ejs");
//Serves static files from "public" directory
app.use(express.static("public"));
//Configures body-parser middleware
app.use(bodyParser.urlencoded({extended: true}));

//Initializes session and passport
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

//Connects to MongoDB Database
const dbUrl = process.env.DB_URL;

const connectDB = async () => {
    try {
        await mongoose.connect(dbUrl, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("MongoDB is connected");
    } catch (error) {
        console.log(error);
    }
}

connectDB();

//Reserve Page Default Rooms Database Layout
const roomsDescriptionSchema = {
    type: String,
    doubles: Number,
    queens: Number,
    kings: Number,
    description: String,
    price: Number,
    image: String,
    rooms: Number
};

//Connects RoomType database with MongoDB
const RoomType = mongoose.model("RoomType", roomsDescriptionSchema);
var rooms = 0;

//Reserve page default single room
const singleRoom = new RoomType({
    type: "Single Room",
    doubles: 0,
    queens: 1,
    kings: 0,
    description: "Enjoy your stay in one of our single rooms at Hillside Suites, with a queen bed, a TV, a couch, and a desk.",
    price: 205, 
    image: "http://cdn.home-designing.com/wp-content/uploads/2019/10/green-and-white-bedroom.jpg",
    rooms: rooms
});

//Reserve page default double room
const doubleRoom = new RoomType({
    type: "Double Room",
    doubles: 2,
    queens: 0,
    kings: 0,
    description: "Enjoy your stay in one of our double rooms at Hillside Suites, with two double beds, a TV, a couch, and a desk.",
    price: 235,
    image: "https://www.nh-hotels.com/corporate/assets/uploads/2022/11/17175816/hotels-design-_int_6_green-rooms.jpg",
    rooms: rooms
});

//Reserve page default triple room
const tripleRoom = new RoomType({
    type: "Triple Room",
    doubles: 2,
    queens: 1,
    kings: 0,
    description: "Enjoy your stay in one of our triple rooms at Hillside Suites, with one queen bed, two double beds, a TV, a couch, and a desk.",
    price: 265,
    image: "https://www.lennoxmiamibeach.com/resourcefiles/homeroomsliderimages/terrace-poolside-double-in-lennoxmiamibeach-florida.jpg",
    rooms: rooms
});

//Reserve page default master suite
const masterSuite = new RoomType({
    type: "Master Suite",
    doubles: 0,
    queens: 2,
    kings: 1,
    description: "Enjoy your stay in one of our master suites at Hillside Suites, with one king bed, two queen beds, two TVs, two couches, a desk, and a large bathtub.",
    price: 295,
    image: "http://cdn.home-designing.com/wp-content/uploads/2020/01/green-bedroom-ideas.jpg",
    rooms: rooms
});

const defaultRooms = [singleRoom, doubleRoom, tripleRoom, masterSuite];

//Available rooms layout in database
const roomsSchema = {
    type: String,
    roomNumber: Number,
    dates: [{
        startDate: String,
        endDate: String
    }]
}

const Room = mongoose.model("Room", roomsSchema);

const allRooms = [];

//Creates 35 unbooked rooms
for (let i = 0; i < 10; i++) {
    const singleRoom = new Room({
        type: "Single Room",
        roomNumber: i + 1,
    });
    allRooms.push(singleRoom);
}

for (let i = 10; i < 20; i++) {
    const doubleRoom = new Room({
        type: "Double Room",
        roomNumber: i + 1,
    });
    allRooms.push(doubleRoom);
}

for (let i = 20; i < 30; i++) {
    const tripleRoom = new Room({
        type: "Triple Room",
        roomNumber: i + 1,
    });
    allRooms.push(tripleRoom);
}

for (let i = 30; i < 35; i++) {
    const masterSuite = new Room({
        type: "Master Suite",
        roomNumber: i + 1,
    });
    allRooms.push(masterSuite);
}

//Orders layout in database
const ordersSchema = {
    name: String,
    email: String,
    googleId: String,
    adults: Number,
    children: Number,
    type: String,
    rooms: [{
        roomNumber: Number
    }],
    startDate: String,
    endDate: String,
    totalPrice: Number,
    canceled: Boolean
}

const Order = mongoose.model("Order", ordersSchema);

//Accounts Database
const usersSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String,
    newRooms: [{ 
        type: {
            type: String
          },
        doubles: Number,
        queens: Number,
        kings: Number,
        description: String,
        price: Number,
        image: String,
        rooms: Number
    }],
    checkoutRooms: [{
        type: {
            type: String
          },
        roomNumber: Number,
        startDate: String,
        endDate: String,
        adults: Number,
        children: Number,
        price: Number
    }]
});

usersSchema.plugin(passportLocalMongoose);
usersSchema.plugin(findOrCreate);

const User = mongoose.model("User", usersSchema);

//Configurations to create cookie session for user
passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    const user = await User.findById(id);
    done(null, user);
});

//Configurations to log in with Google
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/myBookings",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

//Temp New Home Page
app.get("/newHome", async function(req, res){
    res.render("newIndex.ejs", {authenticated: req.isAuthenticated()});

    //Only adds room types to DB once
    const foundRooms = await RoomType.find();
    if (foundRooms.length === 0) {
        RoomType.insertMany(defaultRooms)
        .then(function() {
            console.log("Successfully saved room types to DB.");
        })
        .catch(function(error) {
            console.log(error);
        })
    }

    //Only adds all rooms to DB once
    const foundRooms2 = await Room.find();
    if (foundRooms2.length === 0) {
        Room.insertMany(allRooms)
        .then(function() {
            console.log("Successfully saved all rooms to DB.");
        })
        .catch(function(error) {
            console.log(error);
        })
    }
});

//Website Pages
app.get("/" || "/home", async function(req, res){
    res.render("index.ejs", {authenticated: req.isAuthenticated()});

    //Only adds room types to DB once
    const foundRooms = await RoomType.find();
    if (foundRooms.length === 0) {
        RoomType.insertMany(defaultRooms)
        .then(function() {
            console.log("Successfully saved room types to DB.");
        })
        .catch(function(error) {
            console.log(error);
        })
    }

    //Only adds all rooms to DB once
    const foundRooms2 = await Room.find();
    if (foundRooms2.length === 0) {
        Room.insertMany(allRooms)
        .then(function() {
            console.log("Successfully saved all rooms to DB.");
        })
        .catch(function(error) {
            console.log(error);
        })
    }
});

app.get("/accommodations", function(req, res){
    res.render("accommodations.ejs");
});

app.get("/about", function(req, res){
    res.render("about.ejs");
});

//Sets default booking error (error free)
var bookingError = 0;
var checkoutRooms = [];

app.get("/reserve" || "/book" || "/booknow", async function(req, res){
    // Uses database info to fill the reserve page
    if (req.isAuthenticated()) {
        if (req.user.googleId != null) {
            const availableRooms = await User.find({ googleId: req.user.googleId });
            console.log("available rooms");
            console.log(availableRooms);
            console.log(availableRooms[0].newRooms);
            if (availableRooms[0].newRooms.length === 0 || availableRooms[0].newRooms === null) {
                const availableRooms2 = await RoomType.find();
                console.log("availablerooms2");
                res.render("reserve.ejs", { bookingError, availableRooms: availableRooms2 });
            } else {
                res.render("reserve.ejs", { bookingError, availableRooms: availableRooms[0].newRooms });
            }
        } else {
            const availableRooms = await User.find({ username: req.user.username });
            if (availableRooms[0].newRooms.length === 0 || availableRooms[0].newRooms === null) {
                const availableRooms2 = await RoomType.find();
                res.render("reserve.ejs", {bookingError, availableRooms: availableRooms2});
            } else {
                res.render("reserve.ejs", { bookingError, availableRooms: availableRooms[0].newRooms });
            }
        }
    } else {
        const availableRooms = await RoomType.find();
        res.render("reserve.ejs", {bookingError, availableRooms: availableRooms});
    }
    
});

const mapKey = process.env.MAPS_KEY

app.get("/amenities", function(req, res){
    res.render("amenities.ejs", {mapKey});
});

app.get("/checkout", async function(req, res){
    if (req.isAuthenticated()) {
        if (req.user.googleId != null) {
            const tempCheckoutRooms = await User.findOne({ googleId: req.user.googleId });
            checkoutRooms = tempCheckoutRooms[0].checkoutRooms;
        } else {
            const tempCheckoutRooms = await User.findOne({ username: req.user.username });
            checkoutRooms = tempCheckoutRooms[0].checkoutRooms;
        }
    }
    res.render("checkout.ejs", {checkoutRooms});
});

//Mailchimp success page 
app.get("/mailchimp", function(req, res){    
    //Prevents user from viewing succccess page unless they have entered their email
    if (mailchimpSuccess === 0) {
        res.redirect("/");
    } else {
        res.render("mailchimp.ejs", {mailchimpSuccess});
    }
});

//Redirects user to sign up with Google
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));

app.get("/auth/google/myBookings", 
    passport.authenticate("google", { failureRedirect: "/signUp" }),
    function(req, res) {
        // Successful authentication, redirect home.
        res.redirect("/myBookings");
    });

var registerFailedAttempt = false;

app.get("/register", function(req, res){
    if (!(req.isAuthenticated())) {
        res.render("register.ejs", {registerFailedAttempt});
        registerFailedAttempt = false;
    } else {
        res.redirect("/");
    }
});

var failedAttempt = false;

app.get("/signIn", function(req, res){
    if (!(req.isAuthenticated())) {
        res.render("signIn.ejs", {failedAttempt});
        failedAttempt = false;
    } else {
        res.redirect("/");
    }
});

//My Bookings Page (can only be seen after signed in)
app.get("/myBookings", async function(req, res){
    if (req.isAuthenticated()){
        //Searches for matching orders in database
        if (req.user.username != null) {
            const matchingOrders = await Order.find({email: req.user.username, canceled: null});
            res.render("myBookings.ejs", {orders: matchingOrders});
        } else {
            const matchingOrders = await Order.find({googleId: req.user.googleId, canceled: null});
            res.render("myBookings.ejs", {orders: matchingOrders});
        }
    } else {
        res.redirect("/signIn");
    }
});

//Post route to cancel a booking
app.post("/cancel", async function(req, res){
    const canceledRoomId = req.body.cancelBtn;
    console.log(canceledRoomId);

    //Obtain info from order being deleted in database
    const canceledRoom = await Order.findOne({ _id: canceledRoomId });
            
    //Deletes order from database
    Order.updateOne({ _id: canceledRoomId }, { canceled: true })
    .then(function() {
        console.log("order successfully canceled");        

        //Deletes booked dates from corresponding rooms
        for (let i = 0; i < canceledRoom.rooms.length; i++) {
            Room.updateOne({ roomNumber: canceledRoom.rooms[i].roomNumber }, { $pull: { dates: {startDate: canceledRoom.startDate, endDate: canceledRoom.endDate} } })
            .then(function() {
                console.log("date " + i + " successfully deleted");
            })
            .catch(function(error) {
                console.log(error);
            })
        }
    })
    .catch(function(error) {
        console.log(error);
    })

});

//Register Page
app.post("/register", async function(req, res){

    User.register({username: req.body.username}, req.body.password, function(err, user){
        if (err) {
            console.log(err);
            registerFailedAttempt = true;
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function(){
                registerFailedAttempt = false;
                res.redirect("/myBookings");
            });
        }
    });
});

//SignIn Page
app.post("/signIn", async function(req, res){

    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err){
        if (err) {
            console.log(err);
        } else {
            failedAttempt = true;
            passport.authenticate("local", {failureRedirect: "/signIn"})(req, res, function(){
                failedAttempt = false;
                res.redirect("/myBookings");
            });
        }
    });
});

//Logout Button
app.get("/logout", function(req, res){
    req.logout(function(err) {
        if (err) {
            console.log(err);
        }
    });

    RoomType.deleteMany({})
    .then(function() {
        console.log("available rooms reset");
        
        RoomType.insertMany(defaultRooms)
        .then(function() {
            console.log("Default rooms restored");
        })
        .catch(function(error) {
            console.log(error);
        })
    })
    .catch(function(error) {
        console.log(error);
    })

    res.redirect("/");
});

var comingFromStripe = 0;

//Checkout success page
app.get("/success", async function(req, res){
    //Prevents user from viewing page unless they have checked out
    if (comingFromStripe === 0) {
        res.redirect("/");
    } else {
        const sessionOrder = await stripe.checkout.sessions.retrieve(
            stripeSession.id
        );
        
        //Sets comingFromStripe to 2 to represent a payment error
        if (comingFromStripe === 1 && sessionOrder.payment_status === "unpaid") {
            comingFromStripe = 2;
        } else {
            if (comingFromStripe === 1 && sessionOrder.payment_status === "paid") {
                //Sets comingFromStripe to 3 to prevent entering info to MongoDB twice
                comingFromStripe = 3;
                //Updates Rooms database for each room the user booked
                for (let i = 0; i < finalRooms.length; i++) {
                    Room.updateOne({ roomNumber: finalRooms[i].roomNumber }, { $push: {dates: [{ startDate: finalRooms[i].startDate, endDate: finalRooms[i].endDate }]} })
                        .then(function() {
                            console.log("Rooms booked!");
                        })
                        .catch(function(error) {
                            console.log(error);
                        })
                }

                if (req.isAuthenticated()) {
                    if (req.user.googleId != null) {
                        User.updateOne({ googleId: req.user.googleId }, { $pullAll: { newRooms: newRooms, checkoutRooms: checkoutRooms }})
                        .then(function() {
                            console.log("reset user reserve session");
                        })
                        .catch(function(error) {
                            console.log(error);
                        })
                    } else {
                        User.updateOne({ username: req.user.username }, { $pullAll: { newRooms: newRooms, checkoutRooms: checkoutRooms } })
                        .then(function() {
                            console.log("reset user reserve session");
                        })
                        .catch(function(error) {
                            console.log(error);
                        })
                    }
                }

                //Restores default reserve ejs page
                RoomType.deleteMany({}) 
                    .then(function() {
                        console.log("Available rooms reset");
                    })
                    .then(function() {
                        RoomType.insertMany(defaultRooms)
                            .then(function() {
                                console.log("Default rooms restored");
                            })
                            .catch(function(error) {
                                console.log(error);
                            })
                    })
                    .catch(function(error) {
                        console.log(error);
                    });
        
                const finalRoomNumbers = [];
                
                //Gets booked room numbers as objects in an array
                for (let i = 0; i < finalRooms.length; i++) {
                    const roomNumber = finalRooms[i].roomNumber;
                    const roomObject = { roomNumber: roomNumber };
                    console.log(roomObject);
                    finalRoomNumbers.push(roomObject);
                }
                
                console.log(finalRoomNumbers);
    
                //Adds order to MongoDB
                if (req.isAuthenticated() && req.user.googleId != null) {
                    await Order.create({
                        name: sessionOrder.customer_details.name,
                        email: sessionOrder.customer_details.email,
                        googleId: req.user.googleId,
                        adults: adults * rooms,
                        children: children * rooms,
                        type: finalRooms[0].type,
                        rooms: finalRoomNumbers,
                        startDate: finalRooms[0].startDate,
                        endDate: finalRooms[0].endDate,
                        totalPrice: sessionOrder.amount_total / 100
                    });
                } else {
                    await Order.create({
                        name: sessionOrder.customer_details.name,
                        email: sessionOrder.customer_details.email,
                        adults: adults * rooms,
                        children: children * rooms,
                        type: finalRooms[0].type,
                        rooms: finalRoomNumbers,
                        startDate: finalRooms[0].startDate,
                        endDate: finalRooms[0].endDate,
                        totalPrice: sessionOrder.amount_total / 100
                    });
                }
                
            }
        }

        res.render("success.ejs", {comingFromStripe});
    }    
});

var mailchimpSuccess = 0;

//Mailchimp API
app.post("/", function(req, res){

    const email = req.body.email;

    //Sets user email address to subscribed
    const data = {
        members: [
            {
                email_address: email,
                status: "subscribed"
            }
        ]
    };

    const jsonData = JSON.stringify(data);

    const url = "https://us21.api.mailchimp.com/3.0/lists/7473dea804";

    //Authenticates Mailchimp using API key
    const options = {
        method: "POST",
        auth: process.env.MAILCHIMP_KEY
    }

    const request = https.request(url, options, function(response) {

        //Redirects to success page with mailchimpSuccess as 1 if the request was successful
        if (response.statusCode === 200) {
            mailchimpSuccess = 1;
            res.redirect("/mailchimp");
            
        } else {
            mailchimpSuccess = 2;
            res.redirect("/mailchimp");
        }

        response.on("data", function(data) {
            console.log(JSON.parse(data));
        });
    });

    //Sends data to Mailchimp API
    request.write(jsonData);
    request.end();
});

var roomsFilled = [];
var newRooms = [];
var arrivalDate;
var departureDate;
var totalDays;
var adults;
var children;
var totalPeople;

//Prevents checkRooms function from checking the same room multiple times by comparing the room number
function alreadyChecked(roomNumber) {
    for (let m = 0; m < roomsFilled.length; m++) {
        if (roomsFilled[m] == roomNumber) {
            return true;
        }
    }
    return false;
}

//Function to add available room info to array checckoutRooms
function addToCheckoutRooms(i, rooms) {

    //Sets price of room from default price value
    var price;
    if (rooms[i].type === "Single Room") {
        price = 0;
    } else if (rooms[i].type === "Double Room") {
        price = 1;
    } else if (rooms[i].type === "Triple Room") {
        price = 2;
    } else {
        price = 3;
    }

    //Info that is pushed to checkoutRooms
    const specificRoom = {
        type: rooms[i].type,
        roomNumber: rooms[i].roomNumber,
        startDate: arrivalDate,
        endDate: departureDate,
        adults: adults,
        children: children,
        price: defaultRooms[price].price
    }

    checkoutRooms.push(specificRoom);
}

//Function to check for available rooms
function checkRooms(arrivalDate, departureDate, roomType) {

    //Finds all rooms matching the user's selected room type
    Room.find({type: roomType})
        .then(function(rooms) {

            //Uses UTC dates and the getTime method to universally compare dates
            const testUserStartDate = new Date(arrivalDate);
            var user2StartDate = new Date(Date.UTC(testUserStartDate.getUTCFullYear(), testUserStartDate.getUTCMonth(), testUserStartDate.getUTCDate()));
            userStartDate = user2StartDate.getTime();
            
            const testUserEndDate = new Date(departureDate);
            var user2EndDate = new Date(Date.UTC(testUserEndDate.getUTCFullYear(), testUserEndDate.getUTCMonth(), testUserEndDate.getUTCDate()));
            userEndDate = user2EndDate.getTime();

            totalDays = (userEndDate - userStartDate) / 86400000;

            //Checks each room until it finds one that is vacant
            for (let i = 0; i < rooms.length; i++) {
                //Finds available room if the room is unbooked
                if (rooms[i].dates === []) {
                    if (!(alreadyChecked(rooms[i].roomNumber))) {
                        console.log("found open slot");
                        console.log(i);
                        roomsFilled.push(rooms[i].roomNumber);
                        addToCheckoutRooms(i, rooms);
                        break;
                    }
                }    

                //Checks if user start date and end date is compatible with a booked room
                else {
                    var foundBooking = 1;
                    //For loop to check each room's start and end dates
                    for (let j = 0; j < rooms[i].dates.length; j++) {

                        //Initializes UTC dates
                        const testRoomStartDate = new Date(rooms[i].dates[j].startDate);
                        var test2RoomStartDate = new Date(Date.UTC(testRoomStartDate.getUTCFullYear(), testRoomStartDate.getUTCMonth(), testRoomStartDate.getUTCDate()));
                        roomStartDate = test2RoomStartDate.getTime();
                        
                        const testRoomEndDate = new Date(rooms[i].dates[j].endDate);
                        var test2RoomEndDate = new Date(Date.UTC(testRoomEndDate.getUTCFullYear(), testRoomEndDate.getUTCMonth(), testRoomEndDate.getUTCDate()));
                        roomEndDate = test2RoomEndDate.getTime();

                        //Checks if user's dates are before room's dates
                        if (roomStartDate >= userEndDate) {
                            console.log("room start date is greater or equal to user end date (found before)");
                        //Checks if user's dates are after room's dates
                        } else if (roomEndDate <= userStartDate) {
                            console.log("room end date is less than or equal to user start date (found after)");                     
                        //If both false, overlap is found and foundBooking is set to 0 to show that the room is unavailable
                        } else {
                            foundBooking = 0;
                            break;
                        }

                    }
                    
                    //Adds room to checkoutRooms if it is available and has not already been checked
                    if (foundBooking === 1 && !(alreadyChecked(rooms[i].roomNumber))) {
                        console.log("found open slot");
                        console.log(i); 
                        roomsFilled.push(rooms[i].roomNumber); 
                        addToCheckoutRooms(i, rooms);                      
                        break;
                    }     
                }
            }
        })
        .catch(function(error) {
            console.log(error);
        });
}

//Form submission to calculate available rooms
app.post("/reserve", async function(req, res){

    // const delete1 = await Room.deleteMany({});
    // console.log(delete1);

    // const delete2 = await Order.deleteMany({});
    // console.log(delete2);

    roomsFilled = [];
    checkoutRooms = [];

    //Retrieves info user entered in reserve form
    arrivalDate = req.body.arrivalDate;
    departureDate = req.body.departureDate;
    rooms = req.body.rooms;
    adults = req.body.adults;
    children = req.body.children;
    totalPeople = parseInt(adults) + parseInt(children);

    //Initializes UTC dates
    const today = new Date();
    const todayDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

    const arriveTempDate = new Date(arrivalDate);
    const arrivalCompare = new Date(Date.UTC(arriveTempDate.getUTCFullYear(), arriveTempDate.getUTCMonth(), arriveTempDate.getUTCDate()));

    const departTempDate = new Date(departureDate);
    const departureCompare = new Date(Date.UTC(departTempDate.getUTCFullYear(), departTempDate.getUTCMonth(), departTempDate.getUTCDate()));

    //Send error if total people exceeds maximum room capacity
    if (totalPeople > 6) {
        bookingError = 1;
        res.redirect("/reserve");

    //Send error if invalid dates are entered
    } else if (departureCompare.getTime() <= arrivalCompare.getTime()) {
        bookingError = 3;
        res.redirect("/reserve");
    } else if (arrivalCompare.getTime() <= todayDate.getTime()) {
        bookingError = 3;
        res.redirect("/reserve");

    } else {
        bookingError = 0;

        //Check available room types based on total people per room
        if (totalPeople <= 2) {
            for (let k = 0; k < rooms; k++) {
                checkRooms(arrivalDate, departureDate, "Single Room");
            }
        } else if (totalPeople <= 4) {
            for (let k = 0; k < rooms; k++) {
                checkRooms(arrivalDate, departureDate, "Double Room");
            }
        } else {
            for (let k = 0; k < rooms; k++) {
                checkRooms(arrivalDate, departureDate, "Triple Room");
            }
            for (let k = 0; k < rooms; k++) {
                checkRooms(arrivalDate, departureDate, "Master Suite");
            }
        }

        setTimeout(() => {
            //Sends an error if not all rooms were filled
            if (roomsFilled.length < rooms) {
                bookingError = 2;
                console.log("Not all rooms filled");
                console.log(roomsFilled);
                res.redirect("/reserve");
            } else {
                console.log("Rooms successfully filled!");
                console.log(roomsFilled);
                newRooms = [];
                //Clears current room types to replace with user's available rooms
                RoomType.deleteMany({}) 
                    .then(function() {
                        console.log("Available rooms reset");
                    })
                    .then(function() {
                        var single = 0;
                        var double = 0;
                        var triple = 0;
                        var master = 0;

                        //Creates roomTypes to be displayed on reserve ejs
                        const newSingle = new RoomType({
                            type: "Single Room",
                            doubles: 0,
                            queens: 1,
                            kings: 0,
                            description: "Enjoy your stay in one of our single rooms at Hillside Suites, with a queen bed, a TV, a couch, and a desk.",
                            price: 205, 
                            image: "http://cdn.home-designing.com/wp-content/uploads/2019/10/green-and-white-bedroom.jpg",
                            rooms: rooms
                        });

                        const newDouble = new RoomType({
                            type: "Double Room",
                            doubles: 2,
                            queens: 0,
                            kings: 0,
                            description: "Enjoy your stay in one of our double rooms at Hillside Suites, with two double beds, a TV, a couch, and a desk.",
                            price: 235,
                            image: "https://www.nh-hotels.com/corporate/assets/uploads/2022/11/17175816/hotels-design-_int_6_green-rooms.jpg",
                            rooms: rooms
                        });

                        const newTriple = new RoomType({
                            type: "Triple Room",
                            doubles: 2,
                            queens: 1,
                            kings: 0,
                            description: "Enjoy your stay in one of our triple rooms at Hillside Suites, with one queen bed, two double beds, a TV, a couch, and a desk.",
                            price: 265,
                            image: "https://www.lennoxmiamibeach.com/resourcefiles/homeroomsliderimages/terrace-poolside-double-in-lennoxmiamibeach-florida.jpg",
                            rooms: rooms
                        });

                        const newMaster = new RoomType({
                            type: "Master Suite",
                            doubles: 0,
                            queens: 2,
                            kings: 1,
                            description: "Enjoy your stay in one of our master suites at Hillside Suites, with one king bed, two queen beds, two TVs, two couches, a desk, and a large bathtub.",
                            price: 295,
                            image: "http://cdn.home-designing.com/wp-content/uploads/2020/01/green-bedroom-ideas.jpg",
                            rooms: rooms
                        });

                        //Pushes room type info to newRooms
                        for (let i = 0; i < roomsFilled.length; i++) {
                            if (1 <= roomsFilled[i] && roomsFilled[i] <= 10 && single === 0) {
                                newRooms.push(newSingle);
                                single = 1;
                            }
                            else if (11 <= roomsFilled[i] && roomsFilled[i] <= 20 && double === 0) {
                                newRooms.push(newDouble);
                                double = 1;
                            } else if (21 <= roomsFilled[i] && roomsFilled[i] <= 30 && triple === 0) {
                                newRooms.push(newTriple);
                                triple = 1;
                            } else if (31 <= roomsFilled[i] && roomsFilled[i] <= 35 && master === 0) {
                                newRooms.push(newMaster);
                                master = 1;
                            }
                        }

                        console.log("New Rooms: ");
                        console.log(newRooms);

                    })
                    .then(function() {
                        //Updates database with user's available room types
                        RoomType.insertMany(newRooms) 
                        .then(function() {
                            console.log("Available rooms updated!");
                            console.log(checkoutRooms);
                        })
                        .catch(function(error) {
                            console.log(error);
                        })
                        //Rediret to reserve ejs to show results
                        .finally(function() {

                            //Stores user info in database if user is logged in
                            if (req.isAuthenticated()) {
                                if (req.user.googleId != null) {
                                    User.updateOne({ googleId: req.user.googleId }, { newRooms: newRooms, checkoutRooms: checkoutRooms })
                                    .then(function() {
                                        console.log("user reserve session info stored in db");
                                    })
                                    .catch(function(error) {
                                        console.log(error);
                                    })
                                } else {
                                    User.updateOne({ username: req.user.username }, { newRooms: newRooms, checkoutRooms: checkoutRooms })
                                    .then(function() {
                                        console.log("user reserve session info stored in db");
                                    })
                                    .catch(function(error) {
                                        console.log(error);
                                    })
                                }
                            }
                            res.redirect("/reserve");
                        });
                    })
                    .catch(function(error) {
                        console.log(error);
                    });
            }      
        }, 1000);         
    }    

});

var finalRooms = [];
var stripeSession;

//Stripe checkout
app.post(("/pickRoom"), async function(req, res) {

    const chosenRoom = req.body.roomButton;
    finalRooms = [];
    var checkoutPic;
    //Sets comingFromStripe to 1 to prevent seeing success page without checking out 
    comingFromStripe = 1;
    if (req.isAuthenticated()) {
        if (req.user.googleId != null) {
            const tempUserRooms = await User.findOne({ googleId: req.user.googleId });
            console.log(tempUserRooms);
            newRooms = tempUserRooms.newRooms;
            // console.log("new rooms");
            // console.log(newRooms);
            checkoutRooms = tempUserRooms.checkoutRooms;
            // console.log("checkout rooms");
            // console.log(checkoutRooms);
        } else {
            const tempUserRooms = await User.findOne({ username: req.user.username });
            newRooms = tempUserRooms.newRooms;
            checkoutRooms = tempUserRooms.checkoutRooms;
        }
    }

    //Pushes to final rooms the room type the user selected
    for (let i = 0; i < checkoutRooms.length; i++) {
        if (chosenRoom === checkoutRooms[i].type) {
            finalRooms.push(checkoutRooms[i]);
        }
    }

    //Gets checkout image from user's chosen room type
    for (let j = 0; j < newRooms.length; j++) {
        if (newRooms[j].type === chosenRoom) {
            checkoutPic = newRooms[j].image;
            console.log("checkoutPic");
            console.log(checkoutPic);
            break;
        }
    }    

    console.log("final rooms");
    console.log(finalRooms);

    //Uses UTC dates and the getTime method to universally compare dates
    const testUserStartDate = new Date(finalRooms[0].startDate);
    var user2StartDate = new Date(Date.UTC(testUserStartDate.getUTCFullYear(), testUserStartDate.getUTCMonth(), testUserStartDate.getUTCDate()));
    userStartDate = user2StartDate.getTime();
    
    const testUserEndDate = new Date(finalRooms[0].endDate);
    var user2EndDate = new Date(Date.UTC(testUserEndDate.getUTCFullYear(), testUserEndDate.getUTCMonth(), testUserEndDate.getUTCDate()));
    userEndDate = user2EndDate.getTime();

    totalDays = (userEndDate - userStartDate) / 86400000;

    //Create a new Stripe checkout session
    stripeSession = await stripe.checkout.sessions.create({
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    //Multiply user's number of days with price to calculate price for each room
                    unit_amount: finalRooms[0].price * 100 * totalDays,
                    product_data: {
                        name: finalRooms[0].type,
                        description: "Arrival Date: " + finalRooms[0].startDate + " Departure Date: " + finalRooms[0].endDate,
                        images: [checkoutPic],                        
                    },                    
                },
                quantity: finalRooms.length,                
            },
        ],
        mode: "payment",
        //Redirects to sucess page after checkout
        success_url: `${req.protocol}://${req.get("host")}/success`,
        cancel_url: `${req.protocol}://${req.get("host")}/reserve`,
    });

    //Redirects to Stripe checkout
    res.redirect(stripeSession.url);
});

//Allows app to run locally and on Heroku
app.listen(process.env.PORT || 3000, function() {
console.log("Server is running");
});