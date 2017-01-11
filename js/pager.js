const fs = require('fs');

class Pager {
    constructor(app) {
        app.get('/', this.respondMainPage);
        app.get('/login', this.respondLoginPage);
        app.get('/settings', this.respondSettingsPage);
        app.get('/logout', this.logout);
        app.post('/login', this.postLogin);
        app.post('/make_request', this.postRequest);
        app.post('/update_password', this.updatePassword);
        app.post('/update_email', this.updateEmail);
    }

    respondLoginPage(req, res, next) {
        if (req.session && req.session.authorized) {
            res.redirect('/');
        } else {
            req.session = null;
            res.status(200).render('login');
        }
    }

    postLogin(req, res, next) {
        let logins = JSON.parse(fs.readFileSync(__dirname + '/../data/logins.json'));
        if (logins[req.body.login].password === req.body.password) {
            req.session.authorized = true;
            req.session.user = req.body.login;
            res.redirect('/');
        } else {
            req.session = null;
            res.status(403).send();
        }
    }

    respondSettingsPage(req, res, next) {
        if (!req.session || !req.session.authorized) {
            res.redirect('/login');
            return;
        }
        res.status(200).render('settings');
    }

    updatePassword(req, res, next) {
        if (req.session.user) {
            let logins = JSON.parse(fs.readFileSync(__dirname + '/../data/logins.json'));
            logins[req.session.user].password = req.body.newPassword;
            fs.writeFileSync(__dirname + '/../data/logins.json', JSON.stringify(logins));
            res.redirect('/');
        }
    }

    updateEmail(req, res, next) {
        if (req.session.user) {
            let logins = JSON.parse(fs.readFileSync(__dirname + '/../data/logins.json'));
            logins[req.session.user].email = req.body.newEmail;
            fs.writeFileSync(__dirname + '/../data/logins.json', JSON.stringify(logins));
            res.redirect('/');
        }
    }

    respondMainPage(req, res, next) {
        if (!req.session || !req.session.authorized) {
            res.redirect('/login');
            return;
        }
        if (req.query.mobile === 'true') {
            res.cookie('mobile', 'true');
            res.redirect('/');
        } else if (req.query.mobile === 'false') {
            res.cookie('mobile', 'false');
            res.redirect('/');
        }

        let debts = JSON.parse(fs.readFileSync(__dirname + '/../data/debts.json'));
        let users = JSON.parse(fs.readFileSync(__dirname + '/../data/users.json'));
        let requests = JSON.parse(fs.readFileSync(__dirname + '/../data/requests.json'));
        let logins = JSON.parse(fs.readFileSync(__dirname + '/../data/logins.json'));
        res.status(200);

        let warnAboutEmail = !logins[req.session.user].email;

        if (req.cookies.mobile && req.cookies.mobile === 'true') {
            debts = debts.map(user => {return { 'name': user.name,
                                                'debt': user.debts[req.app.locals.usersIds[req.session.user]]
                                              };
                                      });
            debts.splice(req.app.locals.usersIds[req.session.user], 1);
            res.render('mobile', {
                'warnAboutEmail': warnAboutEmail,
                'debts': debts,
                'requests': requests
            });
        } else {
            res.render('index', {
                'warnAboutEmail': warnAboutEmail,
                'debts': debts,
                'requests': requests,
                'users': users
            });
        }
    }

    postRequest(req, res, next) {
        if (!validator.isInt(''+req.body.money, {min: 1})) {
            res.status(400).send();
            return;
        }
        let requests = JSON.parse(fs.readFileSync(__dirname + '//../data/requests.json'));
        let newElement = {id: 0,
                          from: req.session.user,
                          to: req.body.to,
                          transfer: req.body.money};
        if (requests.length === 0) {
            requests.push(newElement);
        } else {
            newElement.id = requests[0].id + 1;
            requests.unshift(newElement);
        }
        let logins = JSON.parse(fs.readFileSync(__dirname + '//../data/logins.json'));
        if (logins[newElement.to].email) {
          let address = logins[newElement.to].email;
          var message = {
             from:    "PreFX48 <manager@prefx48.me>",
             to:      newElement.to + " <" + address + ">",
             subject: "Денежки",
             attachment:
             [
                {data:"<html><p>Пользователь <strong>" + newElement.from + "</strong> указал, что вы должны ему дополнительно <strong>" + newElement.transfer + "</strong>р</p>\
                       <p>Перейти на сайт: <a href='http://prefx48.me'>prefx48.me</a></p></html>", alternative:true},
             ]
          };
          app.locals.emailServer.send(message, function(err, message) {
            if (err) {console.log(err);
            }
          });
        }
        // TODO: log all sent emails

        let ids = req.app.locals.usersIds;
        let debts = JSON.parse(fs.readFileSync(__dirname + '/../data/debts.json'));
        debts[ids[newElement.from]].debts[ids[newElement.to]] -= parseInt(newElement.transfer);
        debts[ids[newElement.to]].debts[ids[newElement.from]] += parseInt(newElement.transfer);
        fs.writeFileSync(__dirname + '/../data/debts.json',
                         JSON.stringify(debts));

        fs.writeFileSync(__dirname + '/../data/requests.json', JSON.stringify(requests));
        res.redirect('/');
    }

    logout(req, res, next) {
        req.session = null;
        res.redirect('/login');
    }
}

module.exports = Pager;
