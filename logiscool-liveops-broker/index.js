"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express = require("express");
var app = express(), http = require('http').Server(app), io = require('socket.io')(http, {
    origins: '*:*',
    handlePreflightRequest: function (req, res) {
        var headers = {
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-access-token, x-role",
            "Access-Control-Allow-Origin": req.headers.origin,
            "Access-Control-Allow-Credentials": true
        };
        res.writeHead(200, headers);
        res.end();
    }
}), chalk = require('chalk');
var PORT = 3001;
http.listen(PORT, function () {
    console.log(chalk.green("Logiscool LiveOps listening on port " + PORT + "..."));
});
