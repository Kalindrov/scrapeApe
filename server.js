var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");

var request = require("request");
var cheerio = require("cheerio");

var db = require("./models");

var PORT = process.env.PORT || 3000;

var app = express();

// Configure middleware

// Use morgan logger for logging requests
app.use(logger("dev"));
// Use body-parser for handling form submissions
app.use(bodyParser.urlencoded({ extended: true }));
// Use express.static to serve the public folder as a static directory
app.use(express.static("public"));

// By default mongoose uses callbacks for async queries, we're setting it to use promises (.then syntax) instead
// Connect to the Mongo DB
mongoose.Promise = Promise;

var databaseUri = 'mongodb://localhost/scrapeApe';
// var databaseUrl = 'mongodb://heroku_mfjjk6qd:tgvtnim05t1mc15psb55dom13c@ds117625.mlab.com:17625/heroku_mfjjk6qd';

if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI, 
    {  useMongoClient: true });
} else {
  mongoose.connect(databaseUri, 
    {  useMongoClient: true });
}

app.get('/', function(req,res){
	res.render('index');
});

app.get("/scrape", function(req, res) {
  // First, we grab the body of the html with request
  request("http://www.fark.com/", function(error, response, html) {
    var $ = cheerio.load(html);

    // Now, we grab every h2 within an article tag, and do the following:
    $("td span").each(function(i, element) {
      // Save an empty result object
      var result = {};

      // Add the text and href of every link, and save them as properties of the result object
      result.title = $(this)
        .children("a")
        .text();
      result.link = $(this)
        .children("a")
        .attr("href");

      // Create a new Article using the `result` object built from scraping
      db.Article.create(result)
        .then(function(dbArticle) {
          // View the added result in the console
          console.log(dbArticle);
        })
        .catch(function(err) {
          // If an error occurred, send it to the client
          return res.json(err);
        });
    });

    // If we were able to successfully scrape and save an Article, send a message to the client
    res.send("Scrape Complete");
  });
});

// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

app.post("/note/remove/:id", function(req, res) {

  db.Article.findOne({ _id: req.params.id })
  .populate("note")
  .then(function(dbArticle) {
    var noteRemove = dbArticle.note;
    noteRemove.remove().then(function(dbNote) {
    
    return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: null });
    })
  })
  .catch(function(err) {
    res.json(err);
  });
  res.sendStatus(200);
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
