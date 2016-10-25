'use strict';

const express = require('express');
const app = express();
const mustacheExpress = require('mustache-express');
const fs = require('fs');

const PORT = process.env.PORT || 4000;

function zip(...collections) {
    let result = [];
    let min_length = Math.min(...(collections.map((collection) => {return collection.length;})));
    for (let i = 0; i < min_length; ++i) {
        let element = [];
        for (let j = 0; j < collections.length; ++j) {
            element.push(collections[j][i]);
        }
        result.push(element);
    }
    return result;
}

function respond(req, res, next) {
    res.send("hi");
}
// var basicAuth = require('basic-auth');
//
// var auth = function (req, res, next) {
//   function unauthorized(res) {
//     res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
//     return res.send(401);
//   };
//
//   var user = basicAuth(req);
//
//   if (!user || !user.name || !user.pass) {
//     return unauthorized(res);
//   };
//   let users = JSON.parse(fs.readFileSync(__dirname + '/logins.json'));
//   if (users[user.name] === user.pass) {
//     return next();
//   } else {
//     return unauthorized(res);
//   };
// };

function respond(req, res, next) {
    let debts = JSON.parse(fs.readFileSync(__dirname + '/debts.json'));
    let requests = JSON.parse(fs.readFileSync(__dirname + '/requests.json'));
    let users = JSON.parse(fs.readFileSync(__dirname + '/users.json'));
    res.status(200);
    res.render('index', {
        'debts': debts,
        'requests': requests,
        'users': users
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
app.get('/', respond);
app.get('/login', function(req, res) {
    res.status(200).render('login');
});

app.listen(PORT, function () {
    console.log(`App is listening on ${PORT}`);
});
