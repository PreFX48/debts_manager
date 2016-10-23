'use strict';

const express = require('express');
const app = express();
const mustacheExpress = require('mustache-express');
const fs = require('fs');

const PORT = process.env.PORT || 4000;

function respond(req, res, next) {
    res.send("hi");
}
var basicAuth = require('basic-auth');

var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.send(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };
  let users = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
  if (users[user.name] === user.pass) {
    return next();
  } else {
    return unauthorized(res);
  };
};

function respond(req, res, next) {
    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    res.status(200);
    res.render('index', {
        'debts': debts,
        'requests': requests
    });
}

app.engine('html', mustacheExpress());
app.set('view engine', 'html');
app.set('views', __dirname + '/html');

app.use(express.static(__dirname + '/public'));
app.get('/', function(req, res, next) {
    console.log("New request: " + req.method + ' ' + req.originalUrl);
    next();
});
app.get('/', auth, respond);

app.listen(PORT, function () {
    console.log(`App is listening on ${PORT}`);
});